<script setup lang="ts">
import { computed, watch, ref, onMounted, onBeforeUnmount } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

const props = defineProps({
  labels: { type: Array, required: true },
  data: { type: Array, required: true },
  label: { type: String, default: 'Signal' },
})

const effectiveLabels = computed(() => {
  if (props.labels && props.data && props.labels.length === props.data.length) return props.labels
  return Array.from({ length: props.data?.length || 0 }, (_, i) => i)
})

const baseDataset = {
  borderColor: '#36a2eb',
  backgroundColor: 'rgba(54,162,235,0.15)',
  pointRadius: 0,
  tension: 0.2,
}

const chartData = ref({
  labels: [...effectiveLabels.value],
  datasets: [
    {
      ...baseDataset,
      label: props.label,
      data: [...props.data],
    },
  ],
})

const options = ref({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  parsing: false,
  scales: {
    x: { display: true },
    y: { display: true, min: 0, max: 1 },
  },
  plugins: {
    legend: { display: true },
    tooltip: { enabled: true },
  },
})

function computeYRange() {
  const data = props.data || []
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (Number.isFinite(v)) {
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 }
  if (min === max) {
    const pad = Math.abs(min) * 0.1 + 1
    return { min: min - pad, max: max + pad }
  }
  const pad = (max - min) * 0.1
  return { min: min - pad, max: max + pad }
}

function refreshChart() {
  // Clone arrays so Chart.js doesn't mutate Vue state
  chartData.value = {
    labels: [...effectiveLabels.value],
    datasets: [
      {
        ...baseDataset,
        label: props.label,
        data: [...props.data],
      },
    ],
  }
  const { min, max } = computeYRange()
  options.value = {
    ...options.value,
    scales: {
      ...options.value.scales,
      y: { ...options.value.scales.y, min, max },
    },
  }
}

// Update when label or data array length changes
watch(
  () => [effectiveLabels.value.length, props.data.length, props.label],
  () => {
    refreshChart()
  },
)

// Periodic refresh for when data length stays constant (sliding window)
let intervalId = null
onMounted(() => {
  intervalId = setInterval(refreshChart, 150)
})

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <div style="height: 340px; width: 100%">
    <Line :data="chartData" :options="options" />
  </div>
</template>
