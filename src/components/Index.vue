<template>
  <div>{{ symbol }} is {{ price }}</div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  name: 'Index',
  props: ['symbol'],
  computed: mapState({
    price(state) {
      return state.symbol[this.symbol] && state.symbol[this.symbol].ind
        ? state.symbol[this.symbol].ind
        : 0
    },
  }),
}
</script>
