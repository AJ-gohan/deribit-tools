<template>
  <div id="app">
    <router-link to="/iv">IV</router-link> | <router-link to="/pnl">PnL</router-link>
    <router-view></router-view>
  </div>
</template>

<script>
import VueRouter from 'vue-router'
import PnL from './components/PnL.vue'
import IVCurve from './components/IVCurve.vue'
import Index from './components/Index.vue'

import deribit from './deribit'

const routes = [{ path: '/pnl', component: PnL }, { path: '/iv', component: IVCurve }]
const router = new VueRouter({ routes })

export default {
  name: 'app',
  router,
  components: {
    PnL,
    IVCurve,
    Index,
  },
  created() {
    let store = this.$store
    deribit.connected.then(() => {
      store.dispatch('getinstruments').then(() => {
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
