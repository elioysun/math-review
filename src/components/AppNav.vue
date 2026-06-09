<template>
  <header class="app-nav">
    <RouterLink class="brand" to="/">极简错题复习</RouterLink>
    <nav aria-label="主导航">
      <RouterLink to="/">今日记录</RouterLink>
      <RouterLink to="/review">今日复习</RouterLink>
      <RouterLink to="/problems">全部题目</RouterLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
