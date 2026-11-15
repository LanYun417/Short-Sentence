<script setup lang="ts">
/**
 * 用户协议（公开页，可被搜索引擎收录）。
 * 覆盖：服务内容、账号注册与安全、用户行为规范（含 UGC 规则）、知识产权、免责与变更、法律适用。
 */
usePageSeo({
  title: '用户协议',
  description: '使用短句产品前请阅读的用户服务协议。',
  indexable: true,
});

const updatedAt = '2026-11-15';
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 sm:py-10">
    <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">用户协议</h1>
    <p class="mt-1 text-xs text-slate-400">更新日期：{{ updatedAt }}</p>

    <div class="mt-6 space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">1. 协议的接受</h2>
        <p>
          欢迎使用「短句」（下称"本产品"）。注册、登录或使用本产品，即表示你已阅读并同意本协议及《隐私政策》。
          若你不同意本协议的任何内容，请立即停止使用。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">2. 服务内容</h2>
        <p>
          本产品提供英语短句学习服务，包括但不限于：刷题与判分、间隔复习、AI 生成的题目与配图、
          情景闯关对话、句子接龙、组队打卡、每日句签、学习报告与成就体系等。我们可能随产品迭代调整功能，恕不另行通知。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">3. 账号注册与安全</h2>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>你应提供真实、准确的注册信息，并及时更新；因信息不实导致的损失由你自行承担；</li>
          <li>账号仅限本人使用，请妥善保管密码；因你保管不善导致的账号被盗用，由你承担相应责任；</li>
          <li>如发现账号异常，请立即通过「反馈」入口联系我们；</li>
          <li>你可随时在个人中心注销账号；注销后除法律法规要求保留的信息外，我们将删除或匿名化你的数据。</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">4. 用户行为规范</h2>
        <p>你承诺在使用本产品时遵守法律法规，不得：</p>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>发布违法违规、低俗、广告、垃圾或侵犯他人权益的内容（包括接龙、投稿、反馈、群聊消息等 UGC 内容）；</li>
          <li>留下任何联系方式或引流链接；</li>
          <li>利用技术手段刷题、刷榜、刷奖励或干扰服务正常运行；</li>
          <li>冒充他人或未经许可收集其他用户信息。</li>
        </ul>
        <p class="mt-2">
          我们有权对违规内容采取删除、隐藏、限制功能等措施，并视情节暂停或注销违规账号；涉嫌违法的，我们将依法向有关部门报告。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">5. 知识产权</h2>
        <p>
          本产品的软件、界面、题库内容（含 AI 生成内容）、商标等权利归我们或相关权利人所有。
          你在接龙、投稿等版块发布的内容，你保留其权利，并授予我们在本产品范围内免费展示、传播的许可；
          未经许可，不得擅自使用本产品内容。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">6. 免责声明</h2>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>本产品按"现状"提供；因网络、设备或第三方服务导致的中断或数据丢失，我们不承担责任；</li>
          <li>AI 生成的内容仅供学习参考，不构成任何专业建议；</li>
          <li>学习效果因人而异，我们不对学习成果作担保。</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">7. 协议的变更与终止</h2>
        <p>
          我们可能根据业务需要修订本协议，修订后的协议自公布之日起生效。若你不同意修订内容，应停止使用并注销账号；
          继续使用视为接受新协议。我们有权在必要时暂停或终止服务，并提前通过站内通知告知。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">8. 法律适用与联系</h2>
        <p>
          本协议适用中华人民共和国法律。因本协议产生的争议，双方应友好协商；协商不成的，任何一方均可向我们所在地有管辖权的人民法院起诉。
          联系方式：产品内「反馈」入口。
        </p>
      </section>
    </div>
  </div>
</template>
