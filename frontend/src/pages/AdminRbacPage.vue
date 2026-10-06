<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Plus, RefreshCw, Save, Trash2, Users, ChevronLeft, ChevronRight } from '@lucide/vue';
import api from '../api.js';
import { ADMIN_PERMISSIONS, togglePermission } from '../../../shared/admin-permissions.ts';
import UiButton from '../components/ui/Button.vue';
import UserGroupAssignment from '../components/admin/UserGroupAssignment.vue';
import { formatDateTime, t } from '../i18n.js';
import { useUserGroupOptions } from '../composables/useUserGroupOptions.ts';
const choices = useUserGroupOptions();
const roles = ref([]);
const selected = ref(null);
const editorOpen = ref(false);
const busy = ref(false);
const error = ref('');
const members = ref([]);
const memberOffset = ref(0);
const audit = ref([]);
const auditOpen = ref(false);
const auditOffset = ref(0);
const roleOffset = ref(0);
const form = reactive({ name: '', description: '', enabled: true, permissions: [] });
const modules = [...new Set(ADMIN_PERMISSIONS.map((p) => p.module))];
const changes = computed(() => {
  const previous = selected.value?.permissions || [];
  return { added: form.permissions.filter((p) => !previous.includes(p)), removed: previous.filter((p) => !form.permissions.includes(p)) };
});
async function perform(operation) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { await operation(); } catch (e) { error.value = e.message; } finally { busy.value = false; }
}
async function load() { roles.value = (await api.rbacRoles(roleOffset.value)).roles; }
function edit(role = null) {
  selected.value = role; editorOpen.value = true; members.value = [];
  Object.assign(form, { name: role?.name || '', description: role?.description || '', enabled: role?.enabled ?? true, permissions: [...(role?.permissions || [])] });
}
async function save() {
  if (!window.confirm(t('rbac.confirmSave', { count: selected.value?.memberCount || 0, added: changes.value.added.length, removed: changes.value.removed.length }))) return;
  await perform(async () => {
    await api.saveRbacRole(selected.value?.id, { name: form.name, description: form.description, permissions: form.permissions,
      ...(selected.value ? { enabled: form.enabled, expectedRevision: selected.value.revision } : {}) });
    editorOpen.value = false; selected.value = null; await load();
  });
}
async function remove(role) {
  if (!window.confirm(t('rbac.confirmDelete', { name: role.name }))) return;
  await perform(async () => { await api.deleteRbacRole(role.id); if (selected.value?.id === role.id) editorOpen.value = false; await load(); });
}
async function loadMembers(role, offset = 0) {
  if (!choices.roles.value.length) await choices.loadMore();
  selected.value = role; editorOpen.value = false; memberOffset.value = offset;
  await perform(async () => { members.value = (await api.rbacMembers(role.id, offset)).members; });
}
async function memberChanged() {
  await load();
  const role = roles.value.find((r) => r.id === selected.value?.id);
  if (role) await loadMembers(role, memberOffset.value);
}
async function loadAudit(offset = 0) {
  auditOffset.value = offset; auditOpen.value = true;
  await perform(async () => { audit.value = (await api.adminAudit(offset)).events; });
}
async function rolePage(direction) { roleOffset.value += direction * 100; await perform(load); }
onMounted(() => perform(load));
</script>
<template>
  <div class="admin-section rbac-page" :aria-busy="busy">
    <header class="admin-section__header">
      <div class="admin-section__heading"><h2>{{ t('rbac.title') }}</h2><p>{{ t('rbac.description') }}</p></div>
      <div class="inline-actions">
        <UiButton variant="secondary" :disabled="busy" :title="t('common.refresh')" :aria-label="t('common.refresh')" @click="perform(load)"><RefreshCw :size="18" /></UiButton>
        <UiButton :disabled="busy" @click="edit()"><Plus :size="18" />{{ t('rbac.create') }}</UiButton>
      </div>
    </header>
    <p v-if="error || choices.error.value" class="error-text" role="alert">{{ error || choices.error.value }}</p>
    <div class="admin-table-wrap"><table class="list-table">
      <thead><tr><th>{{ t('rbac.group') }}</th><th>{{ t('rbac.members') }}</th><th>{{ t('rbac.permissions') }}</th><th>{{ t('common.status') }}</th><th>{{ t('users.columns.actions') }}</th></tr></thead>
      <tbody><tr v-for="role in roles" :key="role.id">
        <td><strong>{{ role.name }}</strong><p class="muted rbac-description">{{ role.description }}</p></td>
        <td>{{ role.memberCount }}</td><td>{{ role.permissions.length }}</td>
        <td>{{ t(role.enabled ? 'common.enabled' : 'rbac.disabled') }}<div class="muted">{{ formatDateTime(role.updatedAt) }}</div></td>
        <td><div class="inline-actions">
          <UiButton v-if="role.id !== 1" variant="secondary" size="sm" :disabled="busy" @click="edit(role)">{{ t('common.edit') }}</UiButton>
          <UiButton variant="secondary" size="sm" :disabled="busy" :title="t('rbac.members')" :aria-label="t('rbac.members')" @click="loadMembers(role)"><Users :size="17" /></UiButton>
          <UiButton v-if="role.id !== 1" variant="destructive" size="sm" :disabled="busy || role.memberCount > 0" :title="t('common.delete')" :aria-label="t('common.delete')" @click="remove(role)"><Trash2 :size="17" /></UiButton>
        </div></td>
      </tr></tbody>
    </table></div>
    <div class="inline-actions rbac-pagination"><UiButton variant="secondary" :disabled="busy || roleOffset === 0" :aria-label="t('rbac.previous')" @click="rolePage(-1)"><ChevronLeft :size="18" /></UiButton><UiButton variant="secondary" :disabled="busy || roles.length < 100" :aria-label="t('rbac.next')" @click="rolePage(1)"><ChevronRight :size="18" /></UiButton></div>
    <form v-if="editorOpen" class="rbac-editor" @submit.prevent="save">
      <h3>{{ selected ? selected.name : t('rbac.create') }}</h3>
      <div class="rbac-fields"><label class="field"><span>{{ t('rbac.name') }}</span><input v-model.trim="form.name" required maxlength="80" /></label>
        <label class="field"><span>{{ t('rbac.note') }}</span><input v-model.trim="form.description" maxlength="500" /></label></div>
      <label v-if="selected" class="rbac-check"><input v-model="form.enabled" type="checkbox" />{{ t('rbac.enabled') }}</label>
      <div class="rbac-permissions"><fieldset v-for="module in modules" :key="module"><legend>{{ t(`rbac.module.${module}`) }}</legend>
        <label v-for="permission in ADMIN_PERMISSIONS.filter((p) => p.module === module)" :key="permission.key" class="rbac-permission">
          <input type="checkbox" :checked="form.permissions.includes(permission.key)" @change="form.permissions = togglePermission(form.permissions, permission.key, $event.target.checked)" />
          <span><strong>{{ t(`rbac.permission.${permission.key}`) }}</strong><small>{{ t(`rbac.scope.${permission.key}`) }}</small><small v-if="permission.risk !== 'normal'">{{ t(`rbac.risk.${permission.risk}`) }}</small></span>
        </label>
      </fieldset></div>
      <p class="muted">{{ t('rbac.superOnly') }}</p>
      <UiButton type="submit" :disabled="busy || !form.name"><Save :size="17" />{{ t('common.save') }}</UiButton>
    </form>
    <section v-if="selected && !editorOpen" class="rbac-members">
      <h3>{{ selected.name }} · {{ t('rbac.members') }}</h3>
      <p v-if="!members.length" class="muted">{{ t('rbac.noMembers') }}</p>
      <div v-for="user in members" :key="`${user.id}:${user.authzVersion}`" class="rbac-member"><div><strong>{{ user.displayName }}</strong><span class="muted"> @{{ user.username }} {{ user.deletedAt ? t('common.deleted') : '' }}</span></div>
        <UserGroupAssignment :user="{ ...user, role: { id: selected.id, name: selected.name } }" :roles="choices.roles.value" :has-more-roles="choices.hasMore.value" :roles-loading="choices.loading.value" @more-roles="choices.loadMore" @changed="memberChanged" />
      </div>
      <div class="inline-actions"><UiButton variant="secondary" :disabled="busy || memberOffset === 0" :aria-label="t('rbac.previous')" @click="loadMembers(selected, memberOffset - 100)"><ChevronLeft :size="18" /></UiButton><UiButton variant="secondary" :disabled="busy || members.length < 100" :aria-label="t('rbac.next')" @click="loadMembers(selected, memberOffset + 100)"><ChevronRight :size="18" /></UiButton></div>
    </section>
    <section class="rbac-audit"><UiButton variant="secondary" :disabled="busy" @click="loadAudit()">{{ t('rbac.audit') }}</UiButton>
      <template v-if="auditOpen"><div class="admin-table-wrap"><table class="list-table"><thead><tr><th>{{ t('rbac.time') }}</th><th>{{ t('rbac.actor') }}</th><th>{{ t('rbac.action') }}</th><th>{{ t('rbac.target') }}</th></tr></thead><tbody><tr v-for="event in audit" :key="event.id"><td>{{ formatDateTime(event.created_at) }}</td><td>{{ event.actor_name }}</td><td>{{ event.action }}</td><td>{{ event.target || '-' }}</td></tr></tbody></table></div>
        <div class="inline-actions"><UiButton variant="secondary" :disabled="busy || auditOffset === 0" :aria-label="t('rbac.previous')" @click="loadAudit(auditOffset - 100)"><ChevronLeft :size="18" /></UiButton><UiButton variant="secondary" :disabled="busy || audit.length < 100" :aria-label="t('rbac.next')" @click="loadAudit(auditOffset + 100)"><ChevronRight :size="18" /></UiButton></div></template>
    </section>
  </div>
</template>
<style scoped src="../styles/admin/rbac.css"></style>
