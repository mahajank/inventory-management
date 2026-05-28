<template>
  <div class="restocking">
    <div class="page-header">
      <h2>Restocking</h2>
      <p>Recommend items to restock based on demand forecasts and your available budget</p>
    </div>

    <!-- Budget Card -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Available Budget</h3>
      </div>
      <div class="stats-grid" style="margin-bottom: 1.25rem;">
        <div class="stat-card">
          <div class="stat-label">Budget</div>
          <div class="stat-value">{{ currencySymbol }}{{ budget.toLocaleString() }}</div>
        </div>
        <div class="stat-card" :class="selectedTotal > 0 ? 'info' : ''">
          <div class="stat-label">Selected Total</div>
          <div class="stat-value">{{ currencySymbol }}{{ selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
        </div>
        <div class="stat-card" :class="remainingBudget < 0 ? 'danger' : 'success'">
          <div class="stat-label">Remaining Budget</div>
          <div class="stat-value">{{ currencySymbol }}{{ remainingBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
        </div>
      </div>
      <div class="budget-slider-row">
        <input
          type="range"
          class="budget-slider"
          min="0"
          max="100000"
          step="1000"
          v-model.number="budget"
        />
      </div>
      <div class="budget-labels">
        <span>{{ currencySymbol }}0</span>
        <span>{{ currencySymbol }}100,000</span>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading recommendations...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="card">
      <div class="card-header">
        <h3 class="card-title">Recommended Restocking ({{ recommendations.length }} items)</h3>
        <span style="font-size: 0.813rem; color: #64748b;">Sorted by demand growth — highest priority first</span>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 40px;"></th>
              <th>Item</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Warehouse</th>
              <th style="text-align: right;">Current Demand</th>
              <th style="text-align: right;">Forecasted</th>
              <th style="text-align: right;">Growth</th>
              <th style="text-align: right;">Qty to Order</th>
              <th style="text-align: right;">Unit Cost</th>
              <th style="text-align: right;">Total Cost</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in recommendations"
              :key="item.id"
              :class="{ 'row-dimmed': isRowDimmed(item) }"
            >
              <td>
                <input
                  type="checkbox"
                  class="item-check"
                  :checked="isChecked(item.id)"
                  @change="toggleItem(item.id)"
                />
              </td>
              <td><strong>{{ item.item_name }}</strong></td>
              <td style="font-family: monospace; font-size: 0.813rem; color: #64748b;">{{ item.item_sku }}</td>
              <td>{{ item.category }}</td>
              <td>{{ item.warehouse }}</td>
              <td style="text-align: right;">{{ item.current_demand.toLocaleString() }}</td>
              <td style="text-align: right;">{{ item.forecasted_demand.toLocaleString() }}</td>
              <td
                style="text-align: right;"
                :style="item.demand_growth > 0 ? 'color: #059669; font-weight: 600;' : item.demand_growth < 0 ? 'color: #dc2626;' : ''"
              >
                {{ item.demand_growth > 0 ? '+' : '' }}{{ item.demand_growth.toLocaleString() }}
              </td>
              <td style="text-align: right;">{{ item.recommended_quantity.toLocaleString() }}</td>
              <td style="text-align: right;">{{ currencySymbol }}{{ item.unit_cost.toFixed(2) }}</td>
              <td style="text-align: right;"><strong>{{ currencySymbol }}{{ item.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong></td>
              <td><span :class="['badge', item.trend]">{{ item.trend }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="order-actions">
        <div v-if="submitSuccess" class="success-msg">{{ submitSuccess }}</div>
        <div v-if="submitError" class="error-msg">{{ submitError }}</div>
        <button
          class="btn-primary"
          :disabled="!canSubmit"
          @click="submitOrder"
        >
          <span v-if="submitting">Submitting...</span>
          <span v-else>
            Place Order
            <span v-if="selectedItems.length > 0">
              &mdash; {{ selectedItems.length }} {{ selectedItems.length === 1 ? 'item' : 'items' }}
              &middot; {{ currencySymbol }}{{ selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'

export default {
  name: 'Restocking',
  setup() {
    const { currentCurrency } = useI18n()
    const currencySymbol = computed(() => currentCurrency.value === 'JPY' ? '¥' : '$')

    const recommendations = ref([])
    const loading = ref(true)
    const error = ref(null)
    const budget = ref(50000)
    const checkedIds = ref(new Set())
    const submitting = ref(false)
    const submitSuccess = ref(null)
    const submitError = ref(null)

    const selectedItems = computed(() =>
      recommendations.value.filter(item => checkedIds.value.has(item.id))
    )

    const selectedTotal = computed(() =>
      selectedItems.value.reduce((sum, item) => sum + item.total_cost, 0)
    )

    const remainingBudget = computed(() => budget.value - selectedTotal.value)

    const canSubmit = computed(() => selectedItems.value.length > 0 && !submitting.value)

    const isChecked = (id) => checkedIds.value.has(id)

    const toggleItem = (id) => {
      const next = new Set(checkedIds.value)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      checkedIds.value = next
      submitSuccess.value = null
      submitError.value = null
    }

    const isRowDimmed = (item) => !isChecked(item.id) && item.total_cost > budget.value

    const loadRecommendations = async () => {
      try {
        loading.value = true
        error.value = null
        const data = await api.getRestockingRecommendations()
        recommendations.value = data
        const initial = new Set()
        data.forEach(item => {
          if (item.total_cost <= budget.value) {
            initial.add(item.id)
          }
        })
        checkedIds.value = initial
      } catch (err) {
        error.value = 'Failed to load recommendations: ' + err.message
      } finally {
        loading.value = false
      }
    }

    const submitOrder = async () => {
      if (!canSubmit.value) return
      submitting.value = true
      submitSuccess.value = null
      submitError.value = null
      try {
        const items = selectedItems.value.map(item => ({
          sku: item.item_sku,
          name: item.item_name,
          quantity: item.recommended_quantity,
          unit_cost: item.unit_cost,
          category: item.category,
          warehouse: item.warehouse,
        }))
        const order = await api.submitRestockingOrder(items)
        submitSuccess.value = `Order ${order.order_number} submitted. Expected delivery in 14 days.`
        checkedIds.value = new Set()
      } catch (err) {
        submitError.value = 'Failed to submit order: ' + err.message
      } finally {
        submitting.value = false
      }
    }

    onMounted(loadRecommendations)

    return {
      currencySymbol,
      recommendations,
      loading,
      error,
      budget,
      selectedItems,
      selectedTotal,
      remainingBudget,
      canSubmit,
      submitting,
      submitSuccess,
      submitError,
      isChecked,
      toggleItem,
      isRowDimmed,
      submitOrder,
    }
  }
}
</script>

<style scoped>
.budget-slider-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.budget-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: #e2e8f0;
  outline: none;
  cursor: pointer;
}

.budget-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2563eb;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: background 0.15s ease;
}

.budget-slider::-webkit-slider-thumb:hover {
  background: #1d4ed8;
}

.budget-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2563eb;
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.budget-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 0.25rem;
}

.row-dimmed td {
  opacity: 0.35;
}

.item-check {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.order-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid #e2e8f0;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.938rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.success-msg {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
}

.error-msg {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
}
</style>
