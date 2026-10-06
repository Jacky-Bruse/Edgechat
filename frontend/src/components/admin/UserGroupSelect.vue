<script setup>
import { ChevronDown } from '@lucide/vue';
import UiButton from '../ui/Button.vue';
import { t } from '../../i18n.js';
defineProps({ modelValue: Number, roles: Array, hasMore: Boolean, loading: Boolean, disabled: Boolean, currentName: String });
defineEmits(['update:modelValue', 'more']);
</script>
<template>
  <div class="inline-actions">
    <select :value="modelValue" :disabled="disabled || loading" :aria-label="t('rbac.group')" @change="$emit('update:modelValue', Number($event.target.value))">
      <option v-if="!roles.some((role) => role.id === modelValue)" :value="modelValue">{{ currentName || t('rbac.ordinary') }}</option>
      <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.id === 1 ? t('rbac.ordinary') : role.name }}</option>
    </select>
    <UiButton v-if="hasMore" variant="secondary" size="sm" :disabled="disabled || loading" :title="t('rbac.next')" :aria-label="t('rbac.next')" @click="$emit('more')"><ChevronDown :size="16" /></UiButton>
  </div>
</template>
<style scoped>select { max-width: 180px; min-height: 44px; } button { min-height: 44px; min-width: 44px; }</style>
