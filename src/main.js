import Vue from 'vue'
import VueRouter from 'vue-router'
import App from './App.vue'
import store from './store'

Vue.use(VueRouter)
Vue.config.productionTip = false

if (process.env.NODE_ENV === 'development') {
  window.DEBUG = 'deribit:api'
}

new Vue({
  store,
  render: h => h(App),
}).$mount('#app')
