<template>
  <div id="app">
    <div v-if="!credentialsSet">
      <input v-model="key" placeholder="Deribit key">
      <input v-model="secret" placeholder="Deribit secret">
      <button v-on:click="credentials()">Set credentials</button>
    </div>
    <router-link to="/iv">IV</router-link> | <router-link to="/pnl">PnL</router-link> | <router-link to="/delta">Delta hedge</router-link>
    <router-view></router-view>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import VueRouter from 'vue-router'
import PnL from './components/PnL.vue'
import IVCurve from './components/IVCurve.vue'
import Index from './components/Index.vue'
import DeltaHedge from './components/DeltaHedge.vue'

import deribit from './deribit'

const routes = [
  { path: '/pnl', component: PnL },
  { path: '/iv', component: IVCurve },
  { path: '/delta', component: DeltaHedge },
]
const router = new VueRouter({ routes })

export default {
  name: 'app',
  router,
  components: {
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

    if (localStorage.deribit_key) {
      this.key = localStorage.deribit_key
    }
    if (localStorage.deribit_secret) {
      this.secret = localStorage.deribit_secret
    }

    if (this.key && this.secret) {
      this.credentials()
    }

    deribit.connected.then(() => {
      store.commit('ready', 1)
      store.dispatch('getinstruments').then(() => {
        store.commit('ready', 2)

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
            store.commit('orderBookOption', msg)
          } else {
            store.commit('orderBookFuture', msg)
          }
        })

        // Update

        setInterval(function() {
          // Expirations
          Object.keys(store.state.symbol).forEach(symbol => {
            Object.keys(store.state.symbol[symbol].opt).forEach(exp => {
              store.dispatch('updExp', { exp, symbol })
            })
          })

          store.commit('ready', 3)

          // Greeks
          store.dispatch('greeks')
        }, 3000)
      })
    })
  },
  computed: mapState(['readyState', 'dh']),
  methods: {
    credentials: function() {
      deribit.opt.key = this.key
      deribit.opt.secret = this.secret

      localStorage.deribit_key = this.key
      localStorage.deribit_secret = this.secret

      this.credentialsSet = true

      let store = this.$store

      deribit.connected.then(() => {
        store.dispatch('positions').then(() => {
          // Delta hedge
          setInterval(() => {
            if (this.readyState < 4) return

            let { active, target, up, down } = this.dh
            if (!active) return

            let price = store.getters.futurePrice('PERPETUAL')

            let diff = store.getters.delta() - target
            let cont = Math.round(diff * price / 10)

            if (diff > 0 && diff > +up) {
              console.log('removing ', -diff, -cont)
            }

            if (diff < 0 && Math.abs(diff) > +down) {
              console.log('adding ', -diff, -cont)
            }
          }, 3000)
        })
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
