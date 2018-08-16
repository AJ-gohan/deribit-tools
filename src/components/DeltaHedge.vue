<template>
  <div>
    <span>

      <input type="radio" id="radiohedge" value="hedge" v-model="deltaType">
      <label for="radiohedge">Hedge - </label>
      Target: <input v-model="hedge_target" placeholder="target">
      Step up/down: <input v-model="hedge_up" placeholder="up" v-on:blur="check()"> <input v-model="hedge_down" placeholder="down" v-on:blur="check()">
      <br/>
      <input type="radio" id="radiobuilder" value="builder" v-model="deltaType">
      <label for="radiobuilder">Builder - </label>
      Bring {{ delta() | decimal }} delta to 0 at $<input v-model="builder_zero" placeholder="target"> gradually from ${{ price() }} every $<input v-model="builder_step" placeholder="dollars" v-on:blur="check()"> move
    </span>
    <br/>
    <br/>
    Active: <input type="checkbox" v-model="active" v-on:change="check()">
    <button v-on:click="save()">Set</button>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import _ from 'lodash/fp'

export default {
  name: 'DeltaHedge',
  data: function() {
    return {
      deltaType: null,
      active: false,

      builder_zero: 0,
      builder_step: 0,

      hedge_target: 0,
      hedge_up: 0,
      hedge_down: 0,
    }
  },
  filters: {
    decimal: function(value) {
      return Math.round(value * 100) / 100
    },
  },
  mounted() {
    let dh = this.dh

    this.delta_zero = dh.delta_zero || 0
    this.delta_step = dh.delta_step || 0

    this.delta_target = dh.target || 0
    this.delta_up = dh.up || 0
    this.delta_down = dh.down || 0
  },
  computed: {
    ...mapGetters(['futurePrice', 'delta', 'price']),
    ...mapState(['dh']),
  },
  methods: {
    check: function() {
      if (this.deltaType === 'hedge') {
        this.hedge_up = Math.min(Math.max(this.hedge_up, 0.5), this.hedge_target)
        this.hedge_down = Math.min(Math.max(this.hedge_down, 0.5), this.hedge_target)
      }

      if (this.deltaType === 'builder') {
        this.builder_zero = Math.max(this.builder_zero, 0)
        this.builder_step = Math.abs(this.builder_step)
      }
    },
    save: function() {
      this.check()

      let delta = this.delta()
      let price = this.price()

      if (this.deltaType === 'hedge') {
        let ratio = Math.abs(this.builder_zero - price) / price
        if (ratio > 0.5) {
          if (!confirm('You are changing delta too much. OK?')) return
        }
      }

      if (this.deltaType === 'builder') {
        let ratio = Math.abs(this.delta_target - delta) / Math.abs(delta)
        if (ratio > 0.25) {
          if (!confirm('You are aiming too far. OK?')) return
        }
      }

      this.$store.commit('deltaHedge', {
        active: this.active,
        type: this.deltaType,

        builder_delta: delta,
        builder_price: price,
        builder_zero: this.builder_zero,
        builder_step: this.builder_step,

        hedge_target: +this.hedge_target,
        hedge_up: this.hedge_up,
        hedge_down: this.hedge_down,
      })
    },
  },
}
</script>
