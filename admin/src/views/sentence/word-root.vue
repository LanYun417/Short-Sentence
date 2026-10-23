<script setup lang="ts">
/**
 * 词根词典管理页（「短句」运营后台）。
 * 模块职责：查看 AI 生成的词根解析 / 编辑音标释义与结构化解析 / 删除 / 按单词立即解析入库。
 *
 * 数据从哪来：客户端「AI 拓展 · 词根拆解」命中缓存即返回，未命中现场解析并入库；
 * 另有每日任务从题库句子抽词批量补库（系统管理 → 定时任务 → word-root-ingest）。
 * 后台的价值是「兜住内容质量」：AI 拆错的词素、译错的释义要能当场改掉。
 *
 * 权限：v-permission（sentence:wordroot:list/edit/gen/remove），与种子菜单一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import { analyzeWordApi, deleteWordRootApi, getWordRootListApi, updateWordRootApi } from '@/api/word-root';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { WordRootItem, WordRootPart, WordRootPayload } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'SentenceWordRoot' });

/** 词素类型 → 中文标签与颜色 */
const PART_TYPE: Record<string, { label: string; type: 'primary' | 'success' | 'warning' }> = {
  prefix: { label: '前缀', type: 'primary' },
  root: { label: '词根', type: 'success' },
  suffix: { label: '后缀', type: 'warning' },
};

/** 词素类型展示。 */
function partType(type: string): { label: string; type: 'primary' | 'success' | 'warning' } {
  return PART_TYPE[type] ?? { label: type, type: 'primary' };
}

/** 来源文案。 */
function sourceLabel(source: string): string {
  return source === 'daily' ? '每日批量' : '实时解析';
}

const { loading, list, total, query, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getWordRootListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
      source: p.source,
    }),
  { keyword: '', source: undefined as string | undefined },
);

/* ------------------------------ 编辑 ------------------------------ */

const editVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<WordRootPayload>({ phonetic: '', meaning: '', analysisJson: '' });

/** 打开编辑（把结构化的 parts/explanation/related 还原成可编辑 JSON）。 */
function handleEdit(row: WordRootItem): void {
  editingId.value = row.id;
  form.value = {
    phonetic: row.phonetic ?? '',
    meaning: row.meaning ?? '',
    analysisJson: JSON.stringify({ parts: row.parts, explanation: row.explanation, related: row.related }, null, 2),
  };
  editVisible.value = true;
}

/** 格式化 JSON（编辑时手写容易漏逗号，给个一键整理）。 */
function handleFormatJson(): void {
  try {
    const parsed: unknown = JSON.parse(form.value.analysisJson ?? '');
    form.value.analysisJson = JSON.stringify(parsed, null, 2);
    ElMessage.success('已格式化');
  } catch {
    ElMessage.error('不是合法 JSON，请先检查');
  }
}

/** 保存。 */
async function handleSave(): Promise<void> {
  if (editingId.value === null) {
    return;
  }
  // 前端先校验一遍 JSON，避免带着语法错误去撞后端 400（错误提示更直观）
  try {
    JSON.parse(form.value.analysisJson ?? '');
  } catch {
    ElMessage.error('解析结果不是合法 JSON');
    return;
  }
  saving.value = true;
  try {
    await updateWordRootApi(editingId.value, {
      phonetic: form.value.phonetic?.trim() ?? '',
      meaning: form.value.meaning?.trim() ?? '',
      analysisJson: form.value.analysisJson,
    });
    ElMessage.success('保存成功');
    editVisible.value = false;
    await search();
  } finally {
    saving.value = false;
  }
}

/* ------------------------------ 立即解析 ------------------------------ */

const analyzeVisible = ref(false);
const analyzing = ref(false);
const analyzeWord = ref('');

/** 打开「立即解析」。 */
function handleAnalyze(): void {
  analyzeWord.value = '';
  analyzeVisible.value = true;
}

/** 执行解析（命中缓存会直接返回，未命中才调 AI）。 */
async function handleAnalyzeConfirm(): Promise<void> {
  const word = analyzeWord.value.trim().toLowerCase();
  if (!word) {
    ElMessage.warning('请输入单词');
    return;
  }
  analyzing.value = true;
  try {
    const item = await analyzeWordApi(word);
    ElMessage.success(`已入库：${item.word}`);
    analyzeVisible.value = false;
    await search();
  } finally {
    analyzing.value = false;
  }
}

/* ------------------------------ 删除 ------------------------------ */

/** 删除词条（客户端下次检索会重新解析）。 */
async function handleDelete(row: WordRootItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除词条「${row.word}」吗？删除后用户再查会重新调用 AI 解析。`, '提示', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await deleteWordRootApi(row.id);
  ElMessage.success('已删除');
  await search();
}

/* ------------------------------ 详情 ------------------------------ */

const detailVisible = ref(false);
const detail = ref<WordRootItem | null>(null);

/** 打开详情抽屉。 */
function handleDetail(row: WordRootItem): void {
  detail.value = row;
  detailVisible.value = true;
}

/** 词素链展示（前缀 → 词根 → 后缀）。 */
function partsOf(item: WordRootItem | null): WordRootPart[] {
  return item?.parts ?? [];
}
</script>

<template>
  <div class="sentence-word-root-page">
    <el-card shadow="never">
      <SearchForm @search="search" @reset="reset">
        <el-form-item label="单词">
          <el-input
            v-model="query.keyword"
            placeholder="按单词搜索"
            clearable
            style="width: 180px"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="query.source" placeholder="全部" clearable style="width: 130px">
            <el-option label="实时解析" value="ai" />
            <el-option label="每日批量" value="daily" />
          </el-select>
        </el-form-item>
      </SearchForm>

      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">词根词典（共 {{ total }} 个词条）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'sentence:wordroot:gen'" type="primary" @click="handleAnalyze"> 立即解析 </el-button>
          <el-button :loading="loading" @click="search">刷新</el-button>
        </div>
      </div>

      <el-alert
        class="mb-3"
        type="info"
        :closable="false"
        show-icon
        title="批量补词请到「系统管理 → 定时任务」手动执行 word-root-ingest（一次约 100 词，耗时较长）"
      />

      <el-table v-loading="loading" :data="list" border row-key="id">
        <el-table-column prop="word" label="单词" min-width="140">
          <template #default="{ row }">
            <span class="font-medium">{{ row.word }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="phonetic" label="音标" min-width="140">
          <template #default="{ row }">{{ row.phonetic || '—' }}</template>
        </el-table-column>
        <el-table-column prop="meaning" label="释义" min-width="200">
          <template #default="{ row }">{{ row.meaning || '—' }}</template>
        </el-table-column>
        <el-table-column label="词素" min-width="220">
          <template #default="{ row }">
            <el-tag
              v-for="(part, index) in row.parts"
              :key="index"
              :type="partType(part.type).type"
              size="small"
              class="mr-1"
            >
              {{ part.text }}
            </el-tag>
            <span v-if="!row.parts.length" class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="100">
          <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
        </el-table-column>
        <el-table-column prop="searchCount" label="查询次数" width="100" />
        <el-table-column label="更新时间" width="160">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleDetail(row as WordRootItem)">详情</el-button>
            <el-button
              v-permission="'sentence:wordroot:edit'"
              link
              type="primary"
              @click="handleEdit(row as WordRootItem)"
            >
              编辑
            </el-button>
            <el-button
              v-permission="'sentence:wordroot:remove'"
              link
              type="danger"
              @click="handleDelete(row as WordRootItem)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @size-change="changePageSize"
        @current-change="changePage"
      />
    </el-card>

    <!-- 详情 -->
    <el-drawer v-model="detailVisible" title="词条详情" size="440px">
      <div v-if="detail" class="space-y-4">
        <div>
          <p class="text-xl font-semibold">{{ detail.word }}</p>
          <p class="text-sm text-muted">{{ detail.phonetic || '—' }}</p>
          <p class="mt-1">{{ detail.meaning || '—' }}</p>
        </div>

        <div>
          <p class="mb-2 text-sm font-medium">词素构成</p>
          <div class="flex flex-wrap items-center gap-2">
            <template v-for="(part, index) in partsOf(detail)" :key="index">
              <div class="rounded border border-solid border-[var(--el-border-color)] px-3 py-1.5 text-center">
                <div class="font-mono text-sm">{{ part.text }}</div>
                <div class="text-xs text-muted">{{ partType(part.type).label }}</div>
              </div>
              <span v-if="index < partsOf(detail).length - 1" class="text-muted">+</span>
            </template>
            <span v-if="!partsOf(detail).length" class="text-muted">—</span>
          </div>
        </div>

        <div>
          <p class="mb-1 text-sm font-medium">构成说明</p>
          <p class="text-sm leading-relaxed">{{ detail.explanation || '—' }}</p>
        </div>

        <div>
          <p class="mb-1 text-sm font-medium">同根词</p>
          <el-tag v-for="word in detail.related" :key="word" size="small" class="mr-1">{{ word }}</el-tag>
          <span v-if="!detail.related.length" class="text-muted">—</span>
        </div>

        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="来源">{{ sourceLabel(detail.source) }}</el-descriptions-item>
          <el-descriptions-item label="查询次数">{{ detail.searchCount }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDateTime(detail.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-drawer>

    <!-- 编辑 -->
    <BasicDialog v-model="editVisible" title="编辑词条" width="600px" :confirm-loading="saving" @confirm="handleSave">
      <el-form label-width="90px">
        <el-form-item label="音标">
          <el-input v-model="form.phonetic" maxlength="120" placeholder="如 /ˌʌnəˈvɔɪdəbl/" />
        </el-form-item>
        <el-form-item label="释义">
          <el-input v-model="form.meaning" maxlength="300" placeholder="含词性，如 adj. 不可避免的" />
        </el-form-item>
        <el-form-item label="结构化解析">
          <div class="w-full">
            <el-input v-model="form.analysisJson" type="textarea" :rows="12" spellcheck="false" class="font-mono" />
            <div class="mt-1 flex items-center gap-2">
              <el-button size="small" @click="handleFormatJson">格式化</el-button>
              <span class="text-xs text-muted">
                需含 parts（type/text/meaning）、explanation、related；保存后客户端立即生效
              </span>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </BasicDialog>

    <!-- 立即解析 -->
    <BasicDialog
      v-model="analyzeVisible"
      title="立即解析单词"
      width="440px"
      :confirm-loading="analyzing"
      confirm-text="开始解析"
      @confirm="handleAnalyzeConfirm"
    >
      <el-form label-width="70px">
        <el-form-item label="单词" required>
          <el-input
            v-model="analyzeWord"
            placeholder="如 unavoidable（已存在则直接返回）"
            @keyup.enter="handleAnalyzeConfirm"
          />
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="未收录的词会调用 AI 解析，通常 3~10 秒"
          description="解析结果自动入库，客户端下次查询直接命中缓存。"
        />
      </el-form>
    </BasicDialog>
  </div>
</template>
