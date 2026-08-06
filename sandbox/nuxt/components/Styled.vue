<script setup>
import { cva } from '../styled-system/css'

const styledButton = cva({
  base: {
    bgColor: 'black',
  },
  variants: {
    vColor: {
      default: {
        bgColor: 'pink',
      },
      error: {
        bgColor: 'red',
      },
      warning: {
        bgColor: 'yellow',
      },
      info: {
        bgColor: 'cyan',
      },
      secondary: {
        bgColor: 'green',
      },
    },
  },
})
</script>
<template>
  <button id="test" :class="[styledButton(), 'test']">
    <slot></slot>
  </button>
</template>
