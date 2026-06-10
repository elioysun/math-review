<template>
  <header class="app-nav">
    <RouterLink class="brand" to="/">极简错题复习</RouterLink>
    <div class="app-nav__links">
      <nav aria-label="主导航">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/record">今日记录</RouterLink>
        <RouterLink to="/review">今日复习</RouterLink>
        <RouterLink to="/problems">全部题目</RouterLink>
      </nav>
      <a class="github-link" href="https://github.com/elioysun/math-review" target="_blank" rel="noreferrer">GitHub</a>
    </div>
  </header>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
