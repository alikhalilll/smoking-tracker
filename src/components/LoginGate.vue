<template>
  <div class="gate-shell">
    <div class="gate-content">
      <div class="gate-brand">{{ t('app.brand') }}</div>
      <h1 class="gate-title">{{ t('login.title') }}</h1>
      <p class="gate-sub">{{ t('login.subtitle') }}</p>

      <div class="gate-card">
        <SignInCard />
      </div>

      <div class="gate-offline-hint">
        {{ t('login.offline_hint') }}
      </div>
    </div>

    <footer class="gate-footer">
      <div>{{ t('footer.copyright', { from: 2019, to: currentYear }) }}</div>
      <div class="gate-footer-links">
        <a
          href="https://alikhalilll.github.io/"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t('footer.portfolio') }}</a>
        <a
          href="https://github.com/alikhalilll"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t('footer.github') }}</a>
        <a
          href="https://www.linkedin.com/in/alikhalilll/"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t('footer.linkedin') }}</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '../i18n'
import SignInCard from './SignInCard.vue'

const { t } = useI18n()
const currentYear = new Date().getFullYear()
</script>

<style scoped>
.gate-shell {
  max-width: 440px;
  margin: 0 auto;
  padding: 0 1rem;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.gate-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2rem 0;
}
.gate-brand {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 500;
  margin-bottom: 1.5rem;
  text-align: center;
}
.gate-title {
  font-size: 26px;
  font-weight: 600;
  margin: 0 0 8px 0;
  line-height: 1.25;
  text-align: center;
}
.gate-sub {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 1.75rem 0;
  line-height: 1.55;
  text-align: center;
}
.gate-card {
  background: var(--card);
  border-radius: 14px;
  padding: 18px;
}
.gate-offline-hint {
  margin-top: 1rem;
  font-size: 11px;
  color: var(--subtle);
  text-align: center;
  line-height: 1.55;
}
.gate-footer {
  border-top: 1px solid var(--border);
  padding: 1rem 0 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--muted);
  flex-wrap: wrap;
  gap: 10px;
}
.gate-footer-links {
  display: flex;
  gap: 12px;
}
.gate-footer-links a {
  color: var(--text);
  text-decoration: none;
}
.gate-footer-links a:hover {
  color: var(--muted);
}
html[lang='ar'] .gate-brand {
  text-transform: none;
  letter-spacing: 0;
}
</style>
