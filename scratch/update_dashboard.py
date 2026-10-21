# -*- coding: utf-8 -*-
with open(r'frontend\src\pages\Dashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update lucide-react imports
old_import = "  Users,\n  Wallet,\n  Zap,\n} from 'lucide-react';"
new_import = "  Users,\n  Wallet,\n  Zap,\n  Send,\n  BellRing,\n  X,\n} from 'lucide-react';"

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("1. Updated imports")
else:
    print("1. Import match failed")

# 2. Add productsList & showPushModal state
old_state = "  const [activePlots, setActivePlots] = useState([]);\n  const [revChartMode, setRevChartMode] = useState('bar'); // 'bar' | 'area'"
new_state = "  const [activePlots, setActivePlots] = useState([]);\n  const [revChartMode, setRevChartMode] = useState('bar'); // 'bar' | 'area'\n  const [productsList, setProductsList] = useState([]);\n  const [showPushModal, setShowPushModal] = useState(false);"

if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("2. Updated states")
else:
    print("2. State match failed")

# 3. Store productsList in fetchDashboardData
old_prod = "setStats({ plots: plots.data.length, harvest: qty, revenue: rev, cost, products: availableProducts.length, stockValue });"
new_prod = "setStats({ plots: plots.data.length, harvest: qty, revenue: rev, cost, products: availableProducts.length, stockValue });\n      setProductsList(products.data || []);"

if old_prod in content:
    content = content.replace(old_prod, new_prod, 1)
    print("3. Updated setProductsList")
else:
    print("3. setProductsList match failed")

# 4. Pass onOpenPush to AiPanel and render TargetedPushModal
old_aipanel = "          onRun={handleRunAi}\n        />\n      </section>\n    </div>\n  );"
new_aipanel = """          onRun={handleRunAi}
          onOpenPush={() => setShowPushModal(true)}
        />
      </section>

      {showPushModal && (
        <TargetedPushModal
          isOpen={showPushModal}
          onClose={() => setShowPushModal(false)}
          clusters={clusters}
          products={productsList}
        />
      )}
    </div>
  );"""

if old_aipanel in content:
    content = content.replace(old_aipanel, new_aipanel, 1)
    print("4. Updated AiPanel call & modal")
else:
    print("4. AiPanel call match failed")

# 5. Update AiPanel definition with onOpenPush button
old_panel_def = "function AiPanel({ clusters, customers, runningAi, onRun }) {"
new_panel_def = "function AiPanel({ clusters, customers, runningAi, onRun, onOpenPush }) {"
if old_panel_def in content:
    content = content.replace(old_panel_def, new_panel_def, 1)
    print("5. Updated AiPanel signature")

old_btn = """        <button
          onClick={onRun}
          disabled={runningAi}
          className="btn shrink-0 gap-2 shadow-sm hover:shadow-md transition-all self-start sm:self-auto"
        >
          {runningAi ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>กำลังวิเคราะห์...</span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" />
              <span>ประมวลผล AI</span>
            </>
          )}
        </button>"""

new_btn = """        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenPush}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-bold transition shadow-xs hover:shadow-md cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>ยิงแจ้งเตือน LINE</span>
          </button>
          <button
            onClick={onRun}
            disabled={runningAi}
            className="btn shrink-0 gap-2 shadow-sm hover:shadow-md transition-all"
          >
            {runningAi ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>กำลังวิเคราะห์...</span>
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                <span>ประมวลผล AI</span>
              </>
            )}
          </button>
        </div>"""

if old_btn in content:
    content = content.replace(old_btn, new_btn, 1)
    print("6. Updated AiPanel buttons")
else:
    print("6. AiPanel button match failed")

# 6. Append TargetedPushModal definition at the end
modal_code = """

function TargetedPushModal({ isOpen, onClose, clusters, products }) {
  const [targetType, setTargetType] = useState('cluster'); // 'cluster' | 'all'
  const [selectedClusterId, setSelectedClusterId] = useState(clusters[0]?.id || '');
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '');
  const [customCropName, setCustomCropName] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [previewList, setPreviewList] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const currentProduct = products.find(p => String(p.id) === String(selectedProduct));
  const activeCropName = customCropName.trim() || currentProduct?.name || 'ผักสลัดสด GAP';

  useEffect(() => {
    if (clusters.length > 0 && !selectedClusterId) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters]);

  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      setSelectedProduct(products[0].id);
    }
  }, [products]);

  // Real-time recipient preview
  useEffect(() => {
    if (!isOpen) return;
    let cancel = false;
    setLoadingPreview(true);
    const params = {
      target_type: targetType,
      cluster_id: targetType === 'cluster' ? selectedClusterId : undefined,
      crop_name: activeCropName,
    };
    api.get('/api/ai/push-preview', { params })
      .then(res => {
        if (!cancel) setPreviewList(res.data.customers || []);
      })
      .catch(() => {
        if (!cancel) setPreviewList([]);
      })
      .finally(() => {
        if (!cancel) setLoadingPreview(false);
      });
    return () => { cancel = true; };
  }, [isOpen, targetType, selectedClusterId, activeCropName]);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/api/ai/notify-harvest', {
        product_id: currentProduct?.id || null,
        crop_name: activeCropName,
        target_type: targetType,
        cluster_id: targetType === 'cluster' ? selectedClusterId : null,
        custom_title: customTitle.trim() || `🥦 ${activeCropName} สดๆ พร้อมส่งถึงคุณแล้ว!`,
        custom_message: customMessage.trim() || `สวัสดีครับคุณ {name} ทางฟาร์มมี ${activeCropName} สดใหม่ได้มาตรฐานความปลอดภัย GAP พร้อมส่งถึงมือคุณแล้วครับ สนใจกดสั่งซื้อได้ทันที!`,
        cta_label: `🛒 สั่งซื้อ ${activeCropName}`,
      });

      toast.success(res.data?.message || `ยิงแจ้งเตือน LINE สำเร็จ (${res.data?.notified_count || 0} ท่าน) 🎉`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">ยิงแจ้งเตือน LINE ตามกลุ่มเป้าหมาย AI</h3>
              <p className="text-xs text-slate-500">ส่งข้อความ Flex Message เจาะจงเฉพาะกลุ่มลูกค้าที่สนใจ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition border border-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSend} className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {/* Target Group Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              กลุ่มเป้าหมาย (Customer Cluster)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                  targetType === 'all'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs">ลูกค้าทั้งหมดในระบบ</div>
                  <div className="text-[11px] text-slate-400 font-normal">ทุกคนที่มี LINE กับฟาร์ม</div>
                </div>
              </button>

              {clusters.map(c => {
                const isSelected = targetType === 'cluster' && String(selectedClusterId) === String(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setTargetType('cluster');
                      setSelectedClusterId(c.id);
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold shadow-2xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs truncate">{c.cluster_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal truncate">{c.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product / Vegetable to Notify */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                ผัก/สินค้าจากสต็อก
              </label>
              <select
                value={selectedProduct}
                onChange={e => {
                  setSelectedProduct(e.target.value);
                  setCustomCropName('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-emerald-600 bg-white"
              >
                {products.length === 0 ? (
                  <option value="">ไม่มีสินค้าในสต็อก</option>
                ) : (
                  products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (คงเหลือ {p.stock_quantity} {p.unit || 'ถุง'})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                หรือระบุชื่อผักเอง
              </label>
              <input
                type="text"
                value={customCropName}
                onChange={e => setCustomCropName(e.target.value)}
                placeholder="เช่น กรีนโอ๊ค, บัตเตอร์เฮด..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-emerald-600 bg-white"
              />
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              ข้อความแจ้งเตือน (ใช้ {name} แทนชื่อลูกค้าได้)
            </label>
            <textarea
              rows={2}
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder={`สวัสดีครับคุณ {name} วันนี้ฟาร์ม FarmGAP มี ${activeCropName} สดใหม่พร้อมส่งถึงมือคุณแล้วครับ...`}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-emerald-600 bg-white"
            />
          </div>

          {/* Recipient Live Preview */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                รายชื่อผู้รับที่จะได้รับแจ้งเตือน ({previewList.length} ท่าน)
              </span>
              {loadingPreview && <span className="text-[11px] text-slate-400 animate-pulse">กำลังคำนวณผู้รับ...</span>}
            </div>

            {previewList.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {loadingPreview ? 'กำลังดึงข้อมูลผู้รับ...' : 'ไม่พบลูกค้าที่มี LINE ในกลุ่มเป้าหมายนี้'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                {previewList.map(c => (
                  <div
                    key={c.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs shadow-2xs"
                  >
                    {c.picture_url ? (
                      <img src={c.picture_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-bold">
                        {c.name?.slice(0, 1) || 'L'}
                      </div>
                    )}
                    <span className="font-semibold text-slate-700 truncate max-w-[120px]">{c.name || 'ลูกค้า'}</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">
                      {c.cluster_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={sending || previewList.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black transition shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>กำลังส่ง Flex Message...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่งแจ้งเตือน LINE ({previewList.length} ท่าน)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
"""

content = content + modal_code

with open(r'frontend\src\pages\Dashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Finished updating Dashboard.jsx")
