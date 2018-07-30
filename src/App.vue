<template>
  <div id="app">
    <Index symbol="BTC"></Index>
    <IVCurve></IVCurve>
    <PnL></PnL>
    <Positions></Positions>
  </div>
</template>

<script>
import Positions from './components/Positions.vue'
import PnL from './components/PnL.vue'
import IVCurve from './components/IVCurve.vue'
import Index from './components/Index.vue'

import deribit from './deribit'

export default {
  name: 'app',
  components: {
    Positions,
    PnL,
    IVCurve,
    Index,
  },
  created() {
    deribit.connected.then(() => {
      this.$store.dispatch('getinstruments')
      this.$store.dispatch('positions')
    })
  },
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 10px;
}
</style>
