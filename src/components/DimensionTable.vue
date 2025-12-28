<template>
  <div class="dimension-table">
    <div class="actions mb-20">
      <el-input v-model="newItemName" placeholder="输入名称添加新项" style="width: 250px" class="mr-2" @keyup.enter="handleAdd" />
      <el-button type="primary" @click="handleAdd" :disabled="!newItemName.trim()">添加</el-button>
    </div>

    <el-table :data="items" v-loading="loading" border style="width: 100%">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="名称">
          <template #default="{ row }">
              <el-input v-if="editingId === row.id" v-model="editName" size="small" />
              <span v-else>{{ row.name }}</span>
          </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <template v-if="editingId === row.id">
              <el-button size="small" type="success" @click="handleUpdate(row)">保存</el-button>
              <el-button size="small" @click="cancelEdit">取消</el-button>
          </template>
          <template v-else>
              <el-button size="small" @click="startEdit(row)">编辑</el-button>
              <el-popconfirm title="确定删除吗？" @confirm="handleDelete(row.id)">
                <template #reference>
                  <el-button size="small" type="danger">删除</el-button>
                </template>
              </el-popconfirm>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { supabaseService } from '../api/supabaseService'
import { supabase } from '../utils/supabaseClient' // Need raw client for generic fetch or add getMetaList to service
import { ElMessage } from 'element-plus'

const props = defineProps<{
    table: string
}>()

const loading = ref(false)
const items = ref<any[]>([])
const newItemName = ref('')

const editingId = ref<number | null>(null)
const editName = ref('')

const loadData = async () => {
    loading.value = true
    const { data, error } = await supabase.from(props.table).select('*').order('id')
    if (data) {
        items.value = data
    }
    loading.value = false
}

const handleAdd = async () => {
    if (!newItemName.value.trim()) return
    
    // @ts-ignore
    const { data, error } = await supabaseService.createDimension(props.table, newItemName.value.trim())
    if (error) {
        ElMessage.error('添加失败')
    } else {
        ElMessage.success('添加成功')
        newItemName.value = ''
        loadData()
    }
}

const handleDelete = async (id: number) => {
    // @ts-ignore
    const { error } = await supabaseService.deleteDimension(props.table, id)
    if (error) {
        ElMessage.error('删除失败')
    } else {
        ElMessage.success('删除成功')
        loadData()
    }
}

const startEdit = (row: any) => {
    editingId.value = row.id
    editName.value = row.name
}

const cancelEdit = () => {
    editingId.value = null
    editName.value = ''
}

const handleUpdate = async (row: any) => {
    if (!editName.value.trim()) return
    
    // @ts-ignore
    const { error } = await supabaseService.updateDimension(props.table, row.id, editName.value.trim())
    if (error) {
        ElMessage.error('更新失败')
    } else {
        ElMessage.success('更新成功')
        cancelEdit()
        loadData()
    }
}

onMounted(() => {
    loadData()
})

watch(() => props.table, () => {
    loadData()
})
</script>

<style scoped>
.mb-20 { margin-bottom: 20px; }
.mr-2 { margin-right: 10px; }
</style>