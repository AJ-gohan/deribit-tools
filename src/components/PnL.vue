<template>
  <div>
    {{ error }}
    <span>Exp: <select v-model="exp">
        <option v-for="one in expirations()" v-bind:key="one" v-bind:value="one">
          {{ one }}
        </option>
      </select>
      Days: <input v-model="days" placeholder="days to expiration">
    </span>
    <div id="pnl"></div>
  </div>
</template>

<script>
// TODO all expirations together or one by one
// Bound by max, min profit

import { mapState, mapGetters } from 'vuex'
import Chartist from 'chartist'
import Tooltip from 'chartist-plugin-tooltip'
import { price as BSPrice } from '../bs'
import _ from 'lodash/fp'

export default {
  name: 'PnL',
  props: ['symbol'],
  data: function() {
    return {
      error: null,
      exp: null,
      days: null,
      chartOptions: {
        fullWidth: true,
        lineSmooth: false,
        height: 500,
        chartPadding: {
          right: 40,
        },
        plugins: [Tooltip()],
      },
    }
  },
  computed: {
    ...mapGetters(['expirations', 'strikes', 'futurePrice', 'positions', 'ATMIV']),
    ...mapState({
      data(state) {
        let symbol = this.symbol || 'BTC'
        let expiration = this.exp

        if (!expiration) return {}

        let expObj = state.symbol[symbol].opt[expiration]
        // let future = this.futurePrice(expiration)
        let strikes = this.strikes(expiration)

        return {
          labels: strikes,
          series: [
            strikes.map(strike => {
              return _.flow(
                _.sumBy(p => {
                  let [symbol, exp, pStrike, callPut] = p.instrument.split('-')

                  // pUsd = BSPrice(opt.type, rate, strike, exdays, iv, ir);

                  let optPrice =
                    +pStrike === strike
                      ? 0
                      : BSPrice(callPut === 'C' ? 'call' : 'put', strike, +pStrike, 0, 60)

                  return (optPrice - p.avgUSD) * p.size
                }),
                Math.round,
              )(this.positions(expiration))
            }),
          ],
        }
      },
    }),
  },
  watch: {
    data: function(data) {
      this.chart = new Chartist.Line('#pnl', data, this.chartOptions)
    },
  },
}
</script>
