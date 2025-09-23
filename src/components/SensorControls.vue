<template>
  <div class="sensor-controls">
    <div class="sensors">
      <div class="sensor-settings bg-color-primary p-md rounded-s">
        <div class="sensor-title-container">
          <h4 class="sensor-title">Sensor 1</h4>
          <FSwitch id="s1-enabled" v-model="localS1Enabled" />
        </div>
        <div class="led-s1 led-container">
          <div role="radiogroup">
            <label v-for="color in ['red', 'green', 'infrared']" :key="color" class="led-control">
              <CustomRadio
                v-model="localLedS1"
                :value="color"
                name="ledS1"
                class="mb-xs"
                :disabled="!connected"
              />
              {{ color }}
            </label>
          </div>
        </div>
      </div>

      <div class="sensor-settings bg-color-primary p-md rounded-s">
        <div class="sensor-title-container">
          <h4 class="sensor-title">Sensor 2</h4>
          <FSwitch id="s2-enabled" v-model="localS2Enabled" />
        </div>
        <div class="led-s2 led-container">
          <div role="radiogroup">
            <label v-for="color in ['red', 'green', 'infrared']" :key="color" class="led-control">
              <CustomRadio
                v-model="localLedS2"
                :value="color"
                name="ledS2"
                class="mb-xs"
                :disabled="!connected"
              />
              {{ color }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <h3 class="sensor-title">Display</h3>
    <div class="display-sensor-options">
      <label
        v-for="{ label, value } in [
          { label: 'sensor 1', value: 'S1' },
          { label: 'sensor 2', value: 'S2' },
        ]"
        :key="value"
        class="display-control"
      >
        <CustomRadio
          v-model="localSelectedSensor"
          :value="value"
          name="displaySensor"
          :disabled="!connected"
        />
        {{ label }}
      </label>
    </div>
    <div class="segmented-control">
      <button
        v-for="k in availableSignalOptions"
        :key="k"
        :class="{ 'segmented-option': true, selected: localSelectedSignal === k }"
        @click="localSelectedSignal = k"
      >
        {{ k }}
      </button>
    </div>

    <div class="debug-switch">Debug logs <FSwitch v-model="localDebug" /></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { FSwitch } from 'fari-component-library'
import CustomRadio from './CustomRadio.vue'

const props = defineProps<{
  connected: boolean
  s1Enabled: boolean
  s2Enabled: boolean
  ledS1: string
  ledS2: string
  selectedSensor: string
  selectedSignal: string
  debug: boolean
}>()

const emit = defineEmits<{
  (
    e: 'update:settings',
    payload: {
      s1Enabled: boolean
      s2Enabled: boolean
      ledS1: string
      ledS2: string
      selectedSensor: string
      selectedSignal: string
      debug: boolean
    },
  ): void
}>()

// Local state
const localS1Enabled = ref(props.s1Enabled ?? false)
const localS2Enabled = ref(props.s2Enabled ?? false)
const localLedS1 = ref(props.ledS1 ?? 'red')
const localLedS2 = ref(props.ledS2 ?? 'red')
const localSelectedSensor = ref(props.selectedSensor ?? 'S1')
const localSelectedSignal = ref(props.selectedSignal ?? 'TIA')
const localDebug = ref(props.debug ?? false)

const s1Options = ['TIA', 'HPF', 'LPF', 'AMP', 'HR', 'SPO2', 'TEMP']
const s2Options = ['IR', 'RED', 'GREEN', 'HR', 'SPO2']

// Compute available signal options based on selected sensor
const availableSignalOptions = computed(() =>
  localSelectedSensor.value === 'S1' ? s1Options : s2Options,
)

// Ensure selectedSignal is valid when selectedSensor changes
watch(localSelectedSensor, (newSensor) => {
  const validOptions = newSensor === 'S1' ? s1Options : s2Options
  if (!validOptions.includes(localSelectedSignal.value)) {
    localSelectedSignal.value = newSensor === 'S1' ? 'TIA' : 'IR'
  }
})

// Watch all local state and emit settings when they change
watch(
  [
    localS1Enabled,
    localS2Enabled,
    localLedS1,
    localLedS2,
    localSelectedSensor,
    localSelectedSignal,
    localDebug,
  ],
  () => {
    emit('update:settings', {
      s1Enabled: localS1Enabled.value,
      s2Enabled: localS2Enabled.value,
      ledS1: localLedS1.value,
      ledS2: localLedS2.value,
      selectedSensor: localSelectedSensor.value,
      selectedSignal: localSelectedSignal.value,
      debug: localDebug.value,
    })
  },
)
</script>

<style scoped lang="scss">
/* Unchanged styles */
.sensor-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.debug-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sensors {
  display: flex;
  gap: 1rem;
}

.sensor-settings {
  width: 12rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sensor-title {
  margin: 0;
  font-size: 1.2rem;
  color: white;
}

.sensor-title-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.led-control {
  display: flex;
  gap: 0.5rem;
}

.display-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.segmented-control {
  display: flex;
}

.segmented-option {
  cursor: pointer;
  padding: 8px 16px;
  border: 1px solid #ccc;
  background-color: #2f519c;
  font-weight: bold;
  transition: background-color 0.3s ease;
  color: white;
  border: 1px solid #4a8fcd;
  &:first-child {
    border-top-left-radius: 25px;
    border-bottom-left-radius: 25px;
  }
  &:last-child {
    border-top-right-radius: 25px;
    border-bottom-right-radius: 25px;
  }

  &.selected {
    background-color: #4a8fcd;
  }
}

.display-sensor-options {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}
</style>
