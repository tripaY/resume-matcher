<template>
  <MainLayout v-if="!route.meta.hideLayout">
    <router-view />
  </MainLayout>
  <router-view v-else />
</template>

<script setup lang="ts">
import MainLayout from './layouts/MainLayout.vue'
import { useMetaStore } from './stores/metaStore'
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const metaStore = useMetaStore()

onMounted(() => {
  metaStore.fetchMeta()
})
</script>
