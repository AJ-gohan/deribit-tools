<template>
  <div>
    {{ error }}
    <span>Exp: <select v-model="exp">
        <option value="all">all</option>
        <option v-for="one in expirations()" v-bind:key="one" v-bind:value="one">
          {{ one }}
        </option>
      </select>
      after <input v-model="days"> days
       <button v-on:click="days += 1">+1</button>
       <button v-on:click="days -= 1">-1</button>
       <button v-on:click="days = 0">0</button>
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
import zip from 'lodash/zip'

export default {
  name: 'PnL',
  props: ['symbol'],
  data: function() {
    return {
      error: null,
      days: null,
      exp: null,
      chartOptions: {
        fullWidth: true,
        lineSmooth: false,
        height: 500,
        chartPadding: {
          right: 40,
        },
      },
    }
  },
  computed: {
    ...mapGetters(['expirations', 'strikes', 'futurePrice', 'positions', 'ATMIV']),
    // ...mapState({}),
  },
  methods: {
    data: function(st) {
      let state = this.$store.state

      let symbol = this.symbol || 'BTC'
      let expirations = this.exp === 'all' ? this.expirations() : [this.exp]

      let allStrikes = _.flow(
        _.map(exp => this.strikes(exp)),
        _.flatten,
        _.uniq,
        _.sortBy(Number),
      )(expirations)

      let r = _.flow(
        _.map(exp => {
          let expObj = state.symbol[symbol].opt[exp]
          let positions = this.positions(exp)
          let ATMIV = this.ATMIV(exp)

          let days = expObj.days && expObj.days > this.days ? expObj.days - this.days : 0

          return allStrikes.map(strike => {
            return _.flow(
              _.sumBy(p => {
                let [symbol, exp, pStrike, callPut] = p.instrument.split('-')

                // pUsd = BSPrice(opt.type, rate, strike, exdays, iv, ir);
                let price =
                  BSPrice(
                    callPut === 'C' ? 'call' : 'put',
                    strike,
                    +pStrike,
                    days,
                    ATMIV,
                  ) || 0

                return (price - p.avgUSD) * p.size
              }),
            )(positions)
          })
        }),
      )(expirations)

      r = this.exp === 'all' ? _.map(_.sum, zip(...r)) : r[0]

      return {
        labels: allStrikes,
        series: [r],
      }
    },
  },
  watch: {
    exp: function() {
      this.chart = new Chartist.Line('#pnl', this.data(), this.chartOptions)
    },
    days: function() {
      this.chart = new Chartist.Line('#pnl', this.data(), this.chartOptions)
    },
  },
}
</script>
