<script setup>
import { ref } from 'vue';
import { Save, ShieldOff } from '@lucide/vue';
import api from '../../api.js';
import UiButton from '../ui/Button.vue';
import { t } from '../../i18n.js';
import UserGroupSelect from './UserGroupSelect.vue';
const props = defineProps({ user: { type: Object, required: true }, roles: { type: Array, required: true }, hasMoreRoles: Boolean, rolesLoading: Boolean });
const emit = defineEmits(['changed', 'moreRoles']);
const roleId = ref(props.user.role?.id || 1);
const saving = ref(false);
const error = ref('');
const notice = ref('');
async function assign() {
  if (!window.confirm(t('rbac.confirmAssign', { name: props.user.displayName }))) return;
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const result = await api.assignRbacRole(props.user.id, { roleId: roleId.value, expectedAuthzVersion: props.user.authzVersion });
    const count = (result.remainingResources?.invitations.length || 0) + (result.remainingResources?.bridges.length || 0);
    if (count) { notice.value = t('rbac.remainingResources', { count }); window.alert(notice.value); }
    emit('changed');
  } catch (e) { error.value = e.message; } finally { saving.value = false; }
}
async function unprotect() {
  if (!window.confirm(t('rbac.confirmUnprotect', { name: props.user.displayName }))) return;
  saving.value = true; error.value = '';
  try { await api.unprotectUser(props.user.id, props.user.authzVersion); emit('changed'); }
  catch (e) { error.value = e.message; } finally { saving.value = false; }
}
</script>
<template>
  <div v-if="!user.isSuperAdmin" class="group-assignment">
    <div class="inline-actions">
      <UserGroupSelect v-model="roleId" :roles="roles" :has-more="hasMoreRoles" :loading="rolesLoading" :disabled="saving" :current-name="user.role?.name" @more="emit('moreRoles')" />
      <UiButton variant="secondary" size="sm" :disabled="saving" :title="t('rbac.assign')" :aria-label="t('rbac.assign')" @click="assign"><Save :size="16" /></UiButton>
      <UiButton v-if="user.managementProtected && user.role?.id === 1" variant="secondary" size="sm" :disabled="saving" :title="t('rbac.unprotect')" :aria-label="t('rbac.unprotect')" @click="unprotect"><ShieldOff :size="16" /></UiButton>
    </div>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    <p v-if="notice" class="muted" role="status">{{ notice }}</p>
  </div>
</template>
<style scoped>
.group-assignment select { max-width: 180px; min-height: 44px; }
.group-assignment button { min-height: 44px; min-width: 44px; }
.group-assignment p { max-width: 300px; white-space: normal; overflow-wrap: anywhere; }
</style>
