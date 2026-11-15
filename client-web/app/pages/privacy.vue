<script setup lang="ts">
/**
 * 隐私政策（公开页，可被搜索引擎收录）。
 * 覆盖：收集的信息、用途、第三方服务、存储与安全、未成年人保护、注销、联系我们。
 * 修改时注意与实际数据流保持一致（账号 / 学习记录 / 反馈 / AI 生成内容 / 设备信息）。
 */
usePageSeo({
  title: '隐私政策',
  description: '短句如何收集、使用和保护你的个人信息。',
  indexable: true,
});

const updatedAt = '2026-11-15';
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 sm:py-10">
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">隐私政策</h1>
    <p class="mt-1 text-xs text-slate-400">更新日期：{{ updatedAt }}</p>

    <div class="mt-6 space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">1. 我们收集哪些信息</h2>
        <ul class="list-disc space-y-1.5 pl-5">
          <li><b>账号信息</b>：注册/登录时的邮箱（或手机号）、昵称、头像、密码（仅存哈希）。</li>
          <li>
            <b>学习数据</b>：你的答题记录、正确率、复习计划、打卡、XP 与成就、闯关对话内容、接龙与投稿内容、收藏与反馈。
          </li>
          <li><b>设备与日志信息</b>：设备型号、系统版本、IP 地址、访问时间与操作日志（用于安全风控与故障排查）。</li>
          <li><b>你主动上传的内容</b>：头像图片、反馈图片、投稿附图等。</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">2. 我们如何使用这些信息</h2>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>提供刷题、复习、闯关、接龙等核心功能，并同步你的学习进度；</li>
          <li>生成学习报告、排行榜与成就，以及 AI 生成的题目、配图与对话内容；</li>
          <li>保障账号安全（登录风控、异常告警）、排查故障、防止滥用（刷题/灌水/广告）；</li>
          <li>在你开启邮件提醒时，发送学习提醒邮件；</li>
          <li>改进产品：对学习数据做匿名化/聚合统计分析，不指向具体个人。</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">3. 第三方服务</h2>
        <p>
          我们会调用第三方 AI 服务生成题目、配图与对话内容（仅发送生成所需的提示词，不发送你的账号密码）；
          文件存储与对象存储用于保存头像、反馈图片等；站点统计与安全服务用于访问统计与风控。
          这些第三方仅在提供服务所必需的范围内处理数据，并受其自身隐私政策约束。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">4. 存储与安全</h2>
        <p>
          数据存储在中国境内的服务器。我们采取加密传输（HTTPS）、密码哈希存储、访问权限控制、限流与审计日志等措施保护数据安全。
          学习记录默认保留 30 天后自动清理；账号注销后，我们会在合理期限内删除或匿名化你的个人数据。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">5. 未成年人保护</h2>
        <p>
          若你是未成年人，请在监护人陪同下阅读本政策并在其同意后使用本产品。
          我们不会主动向未成年人收集超出提供服务所必需的信息；如监护人发现未成年人向我们提供了个人信息，请联系我们删除。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">6. 你的权利</h2>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>访问、更正你的账号资料与学习数据（个人中心内可自助操作）；</li>
          <li>关闭邮件提醒、删除收藏/投稿等你提交的内容；</li>
          <li>注销账号（个人中心 → 设置 → 注销账号），注销后数据将按第 4 条处理；</li>
          <li>如对本政策有疑问，可通过下方联系方式与我们联系。</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">7. 政策更新</h2>
        <p>
          我们可能不时更新本政策；重大变更会在站内显著位置提示。更新后的政策自公布之日起生效，继续使用产品即视为接受更新后的政策。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">8. 联系我们</h2>
        <p>如对本隐私政策有任何疑问，可通过产品内「反馈」入口联系我们，我们会在合理期限内回复。</p>
      </section>
    </div>
  </div>
</template>
