<template>
  <div id="app">
    <div v-if="!credentialsSet">
      <input v-model="key" placeholder="Deribit key">
      <input v-model="secret" placeholder="Deribit secret">
      <button v-on:click="credentials()">Set credentials</button>
    </div>
    <!-- <Index symbol="BTC"></Index> -->
    <!-- <IVCurve expiration="28DEC18"></IVCurve> -->
    <PnL></PnL>
    <!-- <Positions></Positions> -->
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
  data: function() {
    return {
      credentialsSet: false,
      key: null,
      secret: null,
    }
  },
  created() {
    let store = this.$store
    deribit.connected.then(() => {
      store.dispatch('getinstruments')

      deribit.hook('order_book', msg => {
        if (msg.edp && msg.btc) {
          store.commit('index', { symbol: 'BTC', ind: msg.btc })
          return
        }

        if (!msg.instrument) {
          console.error('Missing instrument', msg)
          return
        }

        if (['C', 'P'].includes(msg.instrument.substring(msg.instrument.length - 1))) {
          store.dispatch('orderBookOption', msg)
        } else {
          store.commit('orderBookFuture', msg)
        }
      })
    })
  },
  methods: {
    credentials: function() {
      deribit.opt.key = this.key
      deribit.opt.secret = this.secret
      this.credentialsSet = true

      let store = this.$store
      deribit.connected.then(() => {
        store.dispatch('positions')
      })
    },
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
