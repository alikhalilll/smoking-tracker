<template>
  <div class="admin-host">
    <AdminLogin
      v-if="!isAuthed"
      @authed="onAuthed"
      @exit="emit('exit')"
    />
    <AdminDashboard
      v-else
      @exit="emit('exit')"
      @signed-out="onSignedOut"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AdminLogin from './AdminLogin.vue'
import AdminDashboard from './AdminDashboard.vue'
import { useAdminApi } from '../composables/useAdminApi'

const emit = defineEmits<{
  exit: []
}>()

const api = useAdminApi()
const isAuthed = computed(() => api.isAuthed.value)

function onAuthed(): void {
  // Reactive — `isAuthed` will already be true; nothing to do.
}

function onSignedOut(): void {
  // Reactive — flips back to AdminLogin automatically.
}
</script>

<style scoped>
.admin-host {
  min-height: 100dvh;
  background: var(--bg);
}
</style>
