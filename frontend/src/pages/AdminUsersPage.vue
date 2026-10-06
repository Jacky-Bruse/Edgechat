<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue';
import { UserRoundSearch } from '@lucide/vue';
import api from '../api.js';
import UserBanDialog from '../components/admin/UserBanDialog.vue';
import UiButton from '../components/ui/Button.vue';
import UiSurface from '../components/ui/Surface.vue';
import { formatDateTime, t } from '../i18n.js';
import { can } from '../authorization.ts';
import store from '../store.js';
import UserGroupAssignment from '../components/admin/UserGroupAssignment.vue';
import { useUserGroupOptions } from '../composables/useUserGroupOptions.ts';

const loading = ref(false);
const error = ref('');
const users = ref([]);
const banDialogUser = ref(null);
const banSaving = ref(false);
const banError = ref('');
const UserDetailsDialog = defineAsyncComponent(() => import('../components/admin/UserDetailsDialog.vue'));
const detailsUser = ref(null);
const detailsOpened = ref(false);
const { roles, hasMore, loading: rolesLoading, error: rolesError, loadMore } = useUserGroupOptions();
const offset = ref(0);
function canTarget(user) { return Boolean(store.session?.isSuperAdmin || (!user.managementProtected && !user.canAccessAdmin && !user.isSuperAdmin)); }
async function editProfile(user) {
  const displayName = window.prompt(t('auth.displayName'), user.displayName);
  if (!displayName?.trim()) return;
  try { await api.updateUser(user.id, { displayName: displayName.trim() }); await loadUsers(); } catch (e) { error.value = e.message; }
}
async function userPage(direction) { offset.value += direction * 100; await loadUsers(); }

function openDetails(user) {
  detailsOpened.value = true;
  detailsUser.value = user;
}

async function loadUsers() {
  loading.value = true;
  error.value = '';
  try {
    const usersPayload = await api.adminUsers(offset.value);
    users.value = usersPayload.users;
  } catch (currentError) {
    error.value = currentError.message;
  } finally {
    loading.value = false;
  }
}

function openBanDialog(user) {
  banDialogUser.value = user;
  banError.value = '';
}

function closeBanDialog() {
  if (banSaving.value) return;
  banDialogUser.value = null;
  banError.value = '';
}

async function disableUser(durationMinutes) {
  const user = banDialogUser.value;
  if (!user) return;

  banSaving.value = true;
  banError.value = '';
  try {
    await api.updateUser(user.id, {
      isDisabled: true,
      banDurationMinutes: durationMinutes
    });
    banDialogUser.value = null;
    await loadUsers();
  } catch (currentError) {
    banError.value = currentError.message;
  } finally {
    banSaving.value = false;
  }
}

async function enableUser(user) {
  try { await api.updateUser(user.id, { isDisabled: false }); await loadUsers(); } catch (e) { error.value = e.message; }
}

function userStatus(user) {
  if (user.isPermanentlyDisabled) return t('users.status.permanent');
  if (user.disabledUntil) {
    return t('users.status.until', { time: formatDateTime(user.disabledUntil) });
  }
  return t('common.active');
}

async function resetPassword(user) {
  const password = window.prompt(t('users.promptNewPassword', { name: user.displayName }));
  if (!password) {
    return;
  }
  try { await api.resetPassword(user.id, password); } catch (e) { error.value = e.message; }
}

async function removeUser(user) {
  if (!window.confirm(t('users.confirmDelete', { name: user.displayName }))) {
    return;
  }
  try { await api.deleteUser(user.id); await loadUsers(); } catch (e) { error.value = e.message; }
}

onMounted(async () => {
  await loadUsers();
  if (store.session?.isSuperAdmin) {
    await loadMore();
  }
});
</script>

<template>
  <div class="admin-section">
    <header class="admin-section__header">
      <div class="admin-section__heading">
        <h2>{{ t('users.title') }}</h2>
        <p>{{ t('users.description') }}</p>
      </div>
      <UiButton variant="secondary" :disabled="loading" @click="loadUsers">
        {{ loading ? t('common.refreshing') : t('users.refresh') }}
      </UiButton>
    </header>

    <div class="admin-section__body">
      <p v-if="error || rolesError" class="error-text">{{ error || rolesError }}</p>

      <UiSurface class="panel panel--table">
        <h3 class="panel-title">{{ t('users.list') }}</h3>
        <div class="admin-table-wrap">
          <table class="list-table">
            <thead>
              <tr>
                <th>{{ t('users.columns.user') }}</th>
                <th>{{ t('users.columns.status') }}</th>
                <th>{{ t('users.columns.createdAt') }}</th>
                <th>{{ t('users.columns.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && !users.length">
                <td colspan="4" class="muted">{{ t('users.loading') }}</td>
              </tr>
              <tr v-else-if="!users.length">
                <td colspan="4" class="muted">{{ t('users.empty') }}</td>
              </tr>
              <tr v-for="user in users" :key="user.id">
                <td>
                  <strong>{{ user.displayName }}</strong>
                  <div class="muted">@{{ user.username }}</div>
                  <div class="muted">{{ t(user.isSuperAdmin ? 'rbac.superAdmin' : user.canAccessAdmin ? 'rbac.subAdmin' : 'rbac.ordinary') }} · {{ user.role?.id === 1 ? t('rbac.ordinary') : user.role?.name }}<span v-if="user.role && !user.role.enabled"> · {{ t('rbac.disabled') }}</span><span v-if="user.managementProtected"> · {{ t('rbac.protected') }}</span></div>
                  <UserGroupAssignment v-if="store.session?.isSuperAdmin" :key="`${user.id}:${user.authzVersion}`" :user="user" :roles="roles" :has-more-roles="hasMore" :roles-loading="rolesLoading" @more-roles="loadMore" @changed="loadUsers" />
                </td>
                <td>{{ userStatus(user) }}</td>
                <td>{{ formatDateTime(user.createdAt) }}</td>
                <td>
                  <div class="inline-actions">
                    <UiButton v-if="can('users.ban') && canTarget(user) && user.isDisabled" variant="secondary" size="sm" @click="enableUser(user)">
                      {{ t('users.enable') }}
                    </UiButton>
                    <UiButton v-else-if="can('users.ban') && canTarget(user) && user.id !== store.session?.userId" variant="destructive" size="sm" @click="openBanDialog(user)">
                      {{ t('users.disable') }}
                    </UiButton>
                    <UiButton v-if="can('users.profile.update') && canTarget(user)" variant="secondary" size="sm" @click="editProfile(user)">{{ t('common.edit') }}</UiButton>
                    <UiButton v-if="store.session?.isSuperAdmin" variant="secondary" size="sm" @click="resetPassword(user)">{{ t('users.resetPassword') }}</UiButton>
                    <UiButton v-if="can('users.delete') && canTarget(user) && user.id !== store.session?.userId" variant="destructive" size="sm" @click="removeUser(user)">{{ t('common.delete') }}</UiButton>
                    <UiButton v-if="can('users.login_history.read') && canTarget(user)" variant="secondary" size="sm" class="user-details-trigger" :title="t('users.details.open')" :aria-label="t('users.details.open')" @click="openDetails(user)">
                      <UserRoundSearch :size="18" aria-hidden="true" />
                    </UiButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiSurface>
      <div class="inline-actions"><UiButton variant="secondary" :disabled="loading || offset === 0" @click="userPage(-1)">{{ t('rbac.previous') }}</UiButton><UiButton variant="secondary" :disabled="loading || users.length < 100" @click="userPage(1)">{{ t('rbac.next') }}</UiButton></div>
    </div>

    <UserBanDialog
      :show="Boolean(banDialogUser)"
      :user="banDialogUser"
      :saving="banSaving"
      :error="banError"
      @close="closeBanDialog"
      @confirm="disableUser"
    />
    <UserDetailsDialog v-if="detailsOpened" :show="Boolean(detailsUser)" :user="detailsUser" @close="detailsUser = null" />
  </div>
</template>

<style scoped>
.user-details-trigger { width: 44px; min-height: 44px; padding: 0; }
</style>
