<template>
  <div>
    <div class="action-bar">
      <el-button type="primary" @click="handleAdd">新增</el-button>
    </div>
    <el-table :data="data" border style="width: 100%">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="名称" />
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button size="small" @click="handleEdit(row)">编辑</el-button>

        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle">
      <el-form :model="form">
        <el-form-item label="名称" label-width="80px">
          <el-input v-model="form.name" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { supabaseService } from '../api/supabaseService'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  type: 'industries' | 'skills' | 'cities',
  data: any[]
}>()

const emit = defineEmits(['refresh'])

const dialogVisible = ref(false)
const dialogTitle = ref('')
const form = reactive({
  id: 0,
  name: ''
})

const handleAdd = () => {
  dialogTitle.value = '新增'
  form.id = 0
  form.name = ''
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  dialogTitle.value = '编辑'
  form.id = row.id
  form.name = row.name
  dialogVisible.value = true
}


const handleSave = async () => {
  if (!form.name) return
  
  let error
  if (form.id) {
    const res = await supabaseService.updateDimension(props.type, form.id, form.name)
    error = res.error
  } else {
    const res = await supabaseService.createDimension(props.type, form.name)
    error = res.error
  }

  if (error) {
    ElMessage.error('保存失败: ' + error.message)
  } else {
    ElMessage.success('保存成功')
    dialogVisible.value = false
    emit('refresh')
  }
}
</script>

<style scoped>
.action-bar {
  margin-bottom: 20px;
}
</style>