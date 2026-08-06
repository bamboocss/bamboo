<script setup lang="ts">
import { ref } from 'vue'
import { css, cva } from '../styled-system/css'
import { vstack } from '../styled-system/patterns'

const CustomInputStyle = cva({
  base: {
    bgColor: 'gray.200',
    px: '4',
    py: '2',
  },
})

const jsxModel = ref('')
const nativeInputModel = ref('')
const styledModel = ref('')
</script>

<template>
  <div :class="vstack()">
    <label>
      JSXModel:
      <input v-model="jsxModel" :class="CustomInputStyle()" />
      Result: {{ jsxModel }}
    </label>
    <label>
      Styled Component:
      <input v-model="styledModel" :class="css({ px: '4', py: '2', bgColor: 'gray.200' })" />
      Result: {{ styledModel }}
    </label>
    <label>
      Native input element:
      <input v-model="nativeInputModel" :class="CustomInputStyle()" />
      Result: {{ nativeInputModel }}
    </label>
  </div>
</template>
