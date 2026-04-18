import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  LineController,
  LineElement,
  PointElement,
} from 'chart.js';
import { Network } from 'vis-network';
import { getAllVideoRecords, getVideoRecordsSince } from '../db';
import { VideoRecord } from '../types';

// Register Chart.js components
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  LineController,
  LineElement,
  PointElement
);

async function initDashboard() {
  const allRecords = await getAllVideoRecords();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentRecords = await getVideoRecordsSince(thirtyDaysAgo);

  renderTimelineChart(recentRecords);
  renderChannelRankChart(allRecords);
  renderNetworkGraph(allRecords);
}

function renderTimelineChart(records: VideoRecord[]) {
  const ctx = document.getElementById('timelineChart') as HTMLCanvasElement;
  if (!ctx) return;

  // Group by day (YYYY-MM-DD)
  const dailyData: Record<string, number> = {};

  // Initialize last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0]!;
    dailyData[dateStr] = 0;
  }

  records.forEach(record => {
    const dateStr = new Date(record.timestamp).toISOString().split('T')[0]!;
    if (dailyData[dateStr] !== undefined) {
      dailyData[dateStr] += record.watchTimeSeconds / 60; // Convert to minutes
    }
  });

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(dailyData),
      datasets: [{
        label: 'Watch Time (minutes)',
        data: Object.values(dailyData),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Minutes'
          }
        }
      }
    }
  });
}

function renderChannelRankChart(records: VideoRecord[]) {
  const ctx = document.getElementById('channelRankChart') as HTMLCanvasElement;
  if (!ctx) return;

  // Aggregate watch time by channel
  const channelData: Record<string, { watchTime: number, iconUrl: string, url: string }> = {};

  records.forEach(record => {
    if (!channelData[record.channelName]) {
      channelData[record.channelName] = { watchTime: 0, iconUrl: record.channelIconUrl, url: record.channelUrl };
    }
    channelData[record.channelName].watchTime += record.watchTimeSeconds;
  });

  const sortedChannels = Object.entries(channelData)
    .sort((a, b) => b[1].watchTime - a[1].watchTime)
    .slice(0, 10); // Top 10

  const labels = sortedChannels.map(item => item[0]);
  const data = sortedChannels.map(item => item[1].watchTime / 60); // In minutes
  const channelInfo = sortedChannels.map(item => item[1]);

  // Preload images
  const images = channelInfo.map(info => {
    const img = new Image();
    img.src = info.iconUrl;
    return img;
  });

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Watch Time (minutes)',
        data: data,
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 40 // Add padding for images
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const url = channelInfo[index]?.url;
          if (url) {
            window.open(url, '_blank');
          }
        }
      }
    },
    plugins: [{
      id: 'customYAxisImages',
      afterDraw: (chart) => {
        const ctx = chart.ctx;
        const yAxis = chart.scales.y;

        yAxis.ticks.forEach((tick, index) => {
          const y = yAxis.getPixelForTick(index);
          const img = images[index];
          if (img && img.complete) {
            // Draw image next to label
            ctx.save();
            ctx.beginPath();
            ctx.arc(yAxis.left - 20, y, 12, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, yAxis.left - 32, y - 12, 24, 24);
            ctx.restore();
          }
        });
      }
    }]
  });
}

function renderNetworkGraph(records: VideoRecord[]) {
  const container = document.getElementById('networkGraph');
  if (!container) return;

  const keywordCounts: Record<string, number> = {};
  const coOccurrences: Record<string, number> = {};

  records.forEach(record => {
    const keywords = record.extractedKeywords || [];
    keywords.forEach((k1, i) => {
      keywordCounts[k1] = (keywordCounts[k1] || 0) + 1;
      for (let j = i + 1; j < keywords.length; j++) {
        const k2 = keywords[j];
        if (!k2) continue;
        const pair = [k1, k2].sort().join('|');
        coOccurrences[pair] = (coOccurrences[pair] || 0) + 1;
      }
    });
  });

  // Filter top keywords to avoid clutter
  const sortedKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(entry => entry[0]);

  const validKeywords = new Set(sortedKeywords);

  const nodes = sortedKeywords.map(kw => ({
    id: kw,
    label: kw,
    value: keywordCounts[kw],
    title: `Occurrences: ${keywordCounts[kw]}`
  }));

  const edges = Object.entries(coOccurrences)
    .map(([pair, weight]) => {
      const [from, to] = pair.split('|');
      return { from: from!, to: to!, value: weight };
    })
    .filter(edge => validKeywords.has(edge.from) && validKeywords.has(edge.to) && edge.value > 1);

  const data = {
    nodes: nodes,
    edges: edges
  };

  const options = {
    nodes: {
      shape: 'dot',
      scaling: {
        min: 10,
        max: 30
      },
      font: {
        size: 14,
        face: 'Tahoma'
      }
    },
    edges: {
      color: { inherit: 'both' },
      smooth: {
        enabled: true,
        type: 'continuous',
        roundness: 0.5
      }
    },
    physics: {
      forceAtlas2Based: {
        gravitationalConstant: -26,
        centralGravity: 0.005,
        springLength: 230,
        springConstant: 0.18
      },
      maxVelocity: 146,
      solver: 'forceAtlas2Based',
      timestep: 0.35,
      stabilization: { iterations: 150 }
    }
  };

  new Network(container, data, options);
}

document.addEventListener('DOMContentLoaded', initDashboard);
