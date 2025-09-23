<!-- components/CustomCheckbox.vue -->
<template>
  <div
    class="custom-checkbox p-xs rounded-s bg-color-blue"
    :class="{ 'card-selected bg-color-blue-light': modelValue }"
    @click="toggleSelection"
  >
    <input type="checkbox" :checked="modelValue" class="checkbox-input" @change="toggleSelection" />
    <div class="checkbox-content">
      <span class="checkbox-label font-weight-semibold">
        {{ label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps<{
  modelValue: boolean
  label: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const toggleSelection = () => {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped lang="scss">
.custom-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;
}

.checkbox-input {
  display: none;
}

.checkbox-content {
  display: flex;
  align-items: center;
}

.card-selected {
  border-color: transparent;
}

.checkbox-label {
  color: white;
  font-size: 1.4rem;
}
</style>
