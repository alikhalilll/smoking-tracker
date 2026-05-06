<template>
  <div class="admin-fill">
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
  /* reactive — `isAuthed` flips to true */
}
function onSignedOut(): void {
  /* reactive — `isAuthed` flips back to false */
}
</script>

<style scoped>
/* Lifts the admin out of the app's normal layout so it can claim the
   entire viewport (sidebar + main) without inheriting any padding
   from the App shell. */
.admin-fill {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--bg);
  overflow: hidden;
  display: flex;
}
</style>
