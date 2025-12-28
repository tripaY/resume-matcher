<template>
  <MainLayout>
    <router-view />
  </MainLayout>
</template>

<script setup lang="ts">
import MainLayout from './layouts/MainLayout.vue'
import { useMetaStore } from './stores/metaStore'
import { onMounted } from 'vue'

const metaStore = useMetaStore()

onMounted(() => {
  metaStore.fetchMeta()
})
</script>
