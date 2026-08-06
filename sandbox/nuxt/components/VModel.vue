<script setup lang="ts">
import { ref } from 'vue'
import { cva } from '../styled-system/css'
import { styled } from '../styled-system/jsx'
import { vstack } from '../styled-system/patterns'

const CustomInputStyle = cva({
  base: {
    bgColor: 'gray.200',
    px: '4',
    py: '2',
  },
})

const CustomJSXInput = styled('input', CustomInputStyle)

const jsxModel = ref('')
const nativeInputModel = ref('')
const styledModel = ref('')
</script>

<template>
  <div :class="vstack()">
    <label>
      JSXModel:
      <CustomJSXInput v-model="jsxModel" />
      Result: {{ jsxModel }}
    </label>
    <label>
      Styled Component:
      <styled.input px="4" py="2" bgColor="gray.200" v-model="styledModel" />
      Result: {{ styledModel }}
    </label>
    <label>
      Native input element:
      <input v-model="nativeInputModel" :class="CustomInputStyle()" />
      Result: {{ nativeInputModel }}
    </label>
  </div>
</template>
