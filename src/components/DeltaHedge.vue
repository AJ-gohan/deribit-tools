<template>
  <div>
    <span>

      <input type="radio" id="radiohedge" value="hedge" v-model="deltaType">
      <label for="radiohedge">Hedge</label>
      <br/>
      Up: limit <input v-model="hedge_limit_up" placeholder="hedge_limit_up"> step <input v-model="hedge_step_up" placeholder="up" v-on:blur="check()">
      <br/>
      Down: limit <input v-model="hedge_limit_down" placeholder="hedge_limit_down"> step <input v-model="hedge_step_down" placeholder="down" v-on:blur="check()">
      <br/>
      <br/>
      <input type="radio" id="radiobuilder" value="builder" v-model="deltaType">
      <label for="radiobuilder">Builder</label>
      <br/>
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

      hedge_limit_up: 0,
      hedge_limit_down: 0,
      hedge_step_up: 0,
      hedge_step_down: 0,
    }
  },
  filters: {
    decimal: function(value) {
      return Math.round(value * 100) / 100
    },
  },
  mounted() {
    let dh = this.dh

    this.hedge_limit_up = dh.hedge_limit_up || 0
    this.hedge_limit_down = dh.hedge_limit_down || 0
    this.hedge_step_up = dh.hedge_step_up || 0
    this.hedge_step_down = dh.hedge_step_down || 0

    this.builder_zero = dh.builder_zero || 0
    this.builder_step = dh.builder_step || 0
  },
  computed: {
    ...mapGetters(['futurePrice', 'delta', 'price']),
    ...mapState(['dh']),
  },
  methods: {
    check: function() {
      if (this.deltaType === 'hedge') {
        this.hedge_limit_up = Math.max(this.hedge_limit_up, this.hedge_limit_down)
        this.hedge_limit_down = Math.min(this.hedge_limit_up, this.hedge_limit_down)

        this.hedge_step_up = Math.max(this.hedge_step_up, 0.1)
        this.hedge_step_down = Math.max(this.hedge_step_down, 0.1)
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
        builder_zero: +this.builder_zero,
        builder_step: +this.builder_step,

        hedge_limit_up: +this.hedge_limit_up,
        hedge_limit_down: +this.hedge_limit_down,
        hedge_step_up: +this.hedge_step_up,
        hedge_step_down: +this.hedge_step_down,
      })
    },
  },
}
</script>
