import React from 'react';
import {
  Bot,
  X,
  Users,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Eye,
  Send,
} from 'lucide-react';

export default function TargetedPushModal({
  pushModalItem,
  onClose,
  pushCropName,
  pushPlot,
  pushForm,
  setPushForm,
  handleTargetTypeChange,
  handleClusterChange,
  clustersList,
  loadingAudience,
  audienceList,
  applyPresetTemplate,
  pushMatchedProduct,
  sendingPush,
  onConfirmPush,
}) {
  if (!pushModalItem) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-start bg-emerald-50/50">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-1">
              <Bot className="w-3.5 h-3.5 text-emerald-700" />
              <span>AI Smart Marketing Broadcast</span>
            </div>
            <h3 className="font-black text-base sm:text-lg text-[#173f2a]">
              ยิงแจ้งเตือน LINE อัจฉริยะ (Targeted Push)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ผลผลิต:{' '}
              <strong className="text-emerald-900">
                {pushCropName || pushModalItem.crop_name || pushPlot?.crop_name || 'ผักสด'}
              </strong>{' '}
              | แปลง: {pushPlot?.name || pushModalItem.plot_name || '-'} | จำนวน:{' '}
              {pushModalItem.quantity} {pushModalItem.unit}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white/80 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-5">
          {/* 1. Audience Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-700" />
              <span>1. เลือกกลุ่มเป้าหมายผู้รับ (Audience)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTargetTypeChange('auto')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  pushForm.target_type === 'auto'
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1">
                    🎯 AI ตรงตามผัก
                  </span>
                  {pushForm.target_type === 'auto' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  ส่งหาเฉพาะคนที่ชอบหรือเคยสั่งผักชนิดนี้
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTargetTypeChange('cluster')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  pushForm.target_type === 'cluster'
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1">
                    🏷️ เจาะจงกลุ่ม AI
                  </span>
                  {pushForm.target_type === 'cluster' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  เลือกส่งตาม Cluster ที่ K-Means จัดไว้
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTargetTypeChange('all')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  pushForm.target_type === 'all'
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1">
                    👥 ลูกค้าทุกคน
                  </span>
                  {pushForm.target_type === 'all' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  บรอดแคสต์หาลูกค้าทุกคนที่มี LINE
                </p>
              </button>
            </div>

            {/* Sub-selector for Cluster */}
            {pushForm.target_type === 'cluster' && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                <label className="text-[11px] font-bold text-slate-600">
                  เลือกกลุ่มลูกค้าที่ต้องการส่ง:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {clustersList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClusterChange(c.id)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition text-left cursor-pointer ${
                        Number(pushForm.cluster_id) === Number(c.id)
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="truncate">{c.cluster_name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live Audience Recipient Preview Box */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>🎯 รายชื่อผู้ที่จะได้รับแจ้งเตือน</span>
                  <span className="bg-emerald-100 text-emerald-900 px-2 py-0.2 rounded-full text-[11px] font-black">
                    {loadingAudience ? 'กำลังตรวจสอบ...' : `${audienceList.length} ท่าน`}
                  </span>
                </span>
              </div>

              {loadingAudience ? (
                <div className="text-[11px] text-slate-400 py-1 flex items-center gap-1.5">
                  <div className="animate-spin text-xs">🌱</div> กำลังคำนวณรายชื่อกลุ่มเป้าหมาย...
                </div>
              ) : audienceList.length === 0 ? (
                <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    ไม่พบลูกค้าที่ตรงตามเงื่อนไขนี้ (แนะนำให้เลือกกลุ่ม AI อื่น
                    หรือเลือกส่งลูกค้าทุกคน)
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {audienceList.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-medium shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{c.name}</span>
                      <span className="text-[9px] text-slate-400">({c.cluster_name})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Message Customization & Templates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                <span>2. ปรับแต่งข้อความแจ้งเตือน (Custom Message)</span>
              </label>

              {/* Preset Buttons */}
              <div className="inline-flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold">เทมเพลตด่วน:</span>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate('fresh')}
                  className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                >
                  🥦 ผักสดใหม่
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate('b2b')}
                  className="text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                >
                  📦 ราคาส่ง B2B
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate('promo')}
                  className="text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                >
                  ⚡ โปรโมชั่นด่วน
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  หัวข้อการ์ด (Title)
                </label>
                <input
                  type="text"
                  value={pushForm.custom_title}
                  onChange={(e) =>
                    setPushForm((f) => ({ ...f, custom_title: e.target.value }))
                  }
                  placeholder="เช่น 🥦 ผักสลัดกรีนโอ๊ค สดๆ เพิ่งเก็บเกี่ยววันนี้!"
                  className="input text-xs w-full rounded-xl"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-600">
                    เนื้อหาข้อความ (Body Message)
                  </label>
                  <span className="text-[10px] text-emerald-700 font-medium">
                    ใส่ {'{name}'} เพื่อเรียกชื่อลูกค้าแต่ละคนอัตโนมัติ
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={pushForm.custom_message}
                  onChange={(e) =>
                    setPushForm((f) => ({ ...f, custom_message: e.target.value }))
                  }
                  placeholder="รายละเอียดข้อความที่ต้องการแจ้งเตือนลูกค้า..."
                  className="input text-xs w-full rounded-xl leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600">
                      ลิงก์รูปภาพประกอบ (Image URL)
                    </label>
                    {pushMatchedProduct?.image_url && (
                      <button
                        type="button"
                        onClick={() =>
                          setPushForm((f) => ({
                            ...f,
                            custom_image_url: pushMatchedProduct.image_url,
                          }))
                        }
                        className="text-[10px] text-emerald-800 hover:text-emerald-900 font-bold inline-flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition"
                        title="คลิกเพื่อดึงรูปจากสินค้านี้"
                      >
                        <span>🖼️ ดึงรูปจากสินค้า</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={pushForm.custom_image_url}
                    onChange={(e) =>
                      setPushForm((f) => ({ ...f, custom_image_url: e.target.value }))
                    }
                    placeholder="https://..."
                    className="input text-xs w-full rounded-xl"
                  />
                  {pushMatchedProduct && (
                    <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1 font-medium truncate">
                      <span>✨ ดึงจากสินค้า:</span>
                      <span className="font-bold">{pushMatchedProduct.name}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    ข้อความบนปุ่มหลัก (สั่งซื้อทันทีใน LINE แชท)
                  </label>
                  <input
                    type="text"
                    value={pushForm.cta_label}
                    onChange={(e) =>
                      setPushForm((f) => ({ ...f, cta_label: e.target.value }))
                    }
                    placeholder="เช่น 🛒 กดสั่งซื้อผักสดทันที"
                    className="input text-xs w-full rounded-xl"
                  />
                  <p className="text-[10px] text-emerald-700 mt-1">
                    * เมื่อลูกค้ากดปุ่มนี้ ระบบจะส่งการ์ดเลือกจำนวนผักในห้องแชท LINE ทันที (ไม่ต้องเปิดเว็บ)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Live Phone Flex Preview */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-700" />
              <span>3. ตัวอย่างข้อความที่จะแสดงใน LINE ลูกค้า (Live Preview)</span>
            </label>

            <div className="bg-[#74889e]/20 p-3 sm:p-4 rounded-2xl flex justify-center">
              {/* LINE Bubble Mockup */}
              <div className="max-w-xs w-full bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden text-slate-800">
                {/* Hero Image */}
                <div className="h-36 bg-slate-100 relative overflow-hidden">
                  <img
                    src={
                      pushForm.custom_image_url ||
                      'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop'
                    }
                    alt="Preview Hero"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src =
                        'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop';
                    }}
                  />
                  <span className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                    FarmGAP Standard
                  </span>
                </div>

                {/* Body */}
                <div className="p-3.5 space-y-2">
                  <h4 className="font-black text-sm text-emerald-800 line-clamp-2 leading-tight">
                    {pushForm.custom_title ||
                      `🥦 ${pushPlot?.crop_name || 'ผักสด'} เพิ่งเก็บเกี่ยววันนี้!`}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {(pushForm.custom_message || '').replace(
                      /{name}/g,
                      audienceList[0]?.name || 'ลูกค้าคนพิเศษ'
                    )}
                  </p>
                </div>

                {/* Two Buttons: Direct Order + View Menu */}
                <div className="p-3 pt-0 space-y-1.5">
                  <div className="w-full py-2 bg-emerald-700 text-white font-bold text-center text-xs rounded-xl shadow-xs">
                    {pushForm.cta_label || '🛒 กดสั่งซื้อผักสดทันที'}
                  </div>
                  <div className="w-full py-2 bg-emerald-50 text-emerald-800 font-bold text-center text-xs rounded-xl border border-emerald-200 shadow-2xs">
                    🥗 ดูเมนูผักทั้งหมด
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={onConfirmPush}
            disabled={sendingPush || audienceList.length === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-4 h-4 text-emerald-200" />
            <span>
              {sendingPush
                ? 'กำลังยิง LINE Push...'
                : audienceList.length === 0
                ? 'ไม่มีผู้รับในกลุ่มนี้'
                : `🚀 ยืนยันยิง LINE Push (${audienceList.length} ท่าน)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
