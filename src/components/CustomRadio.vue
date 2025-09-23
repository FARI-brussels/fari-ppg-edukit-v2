<!-- CustomRadio.vue -->
<template>
  <label class="custom-radio" :class="{ 'is-checked': modelValue === value }">
    <input
      type="radio"
      :value="value"
      :name="name"
      :checked="modelValue === value"
      @change="$emit('update:modelValue', value)"
      class="custom-radio__input"
    />
    <span class="custom-radio__circle"></span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | number | boolean
  value: string | number | boolean
  name?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string | number | boolean): void
}>()
</script>

<style scoped>
.custom-radio {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  user-select: none;
}

.custom-radio__input {
  opacity: 0;
  position: absolute;
  width: 0;
  height: 0;
}

.custom-radio__circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #fff;
  border: 2px solid #4393de;
  position: relative;
  transition: all 0.2s ease;
}

.custom-radio.is-checked .custom-radio__circle {
  background-color: #4393de;
}

.custom-radio.is-checked .custom-radio__circle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #fff;
}
</style>
