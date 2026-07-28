export const dashboardStyles = `
.vld-app{--vld-max:1240px;box-sizing:border-box;width:100%;height:100%;min-height:0;overflow:auto;background:var(--background-base);color:var(--text-base);font-family:var(--font-family-sans,system-ui,-apple-system,sans-serif);font-size:14px;line-height:1.55}
.vld-app *{box-sizing:border-box}
.vld-app button,.vld-app input,.vld-app select,.vld-app textarea{font:inherit}
.vld-shell{width:min(100%,calc(var(--vld-max) + 96px));min-height:100%;margin:0 auto;padding:34px 48px 72px}
.vld-topbar{position:relative;z-index:5;display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding-bottom:18px;border-bottom:1px solid color-mix(in srgb,var(--border-base) 52%,transparent)}
.vld-brand{margin:0;color:var(--text-strong);font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.02em}
.vld-tabs{display:flex;align-items:center;gap:4px;margin-top:22px}
.vld-tab{min-height:40px;border:0;border-radius:9px;background:transparent;color:var(--text-weak);padding:8px 14px;font-weight:550;cursor:pointer}
.vld-tab:hover{background:var(--surface-hover-base);color:var(--text-base)}
.vld-tab[data-active=true]{background:var(--surface-interactive-selected);color:var(--text-interactive-base)}
.vld-top-actions{display:flex;align-items:center;gap:9px}
.vld-profile-trigger{display:flex;min-width:245px;max-width:360px;min-height:42px;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--border-weaker-base);border-radius:9px;background:var(--surface-base);color:var(--text-base);padding:8px 12px;text-align:left;cursor:pointer}
.vld-profile-trigger:hover{background:var(--surface-base-hover)}
.vld-profile-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vld-profile-chevron{color:var(--text-weaker);font-size:12px}
.vld-icon-button{display:grid;width:42px;height:42px;place-items:center;border:1px solid var(--border-weaker-base);border-radius:9px;background:var(--surface-base);color:var(--text-base);cursor:pointer}
.vld-icon-button:hover{background:var(--surface-base-hover)}
.vld-header-settings{min-height:42px;white-space:nowrap}
.vld-main{padding-top:30px}
.vld-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:28px}
.vld-eyebrow{margin:0 0 6px;color:var(--text-interactive-base);font-size:12px;font-weight:650;letter-spacing:.04em}
.vld-page-title{margin:0;color:var(--text-strong);font-size:30px;line-height:1.2;font-weight:720;letter-spacing:-.03em}
.vld-page-copy{max-width:68ch;margin:8px 0 0;color:var(--text-weak)}
.vld-section{margin-top:32px}
.vld-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:14px}
.vld-section-title{margin:0;color:var(--text-strong);font-size:17px;line-height:1.35;font-weight:650}
.vld-section-copy{margin:3px 0 0;color:var(--text-weak);font-size:13px}
.vld-link-button{border:0;background:transparent;color:var(--text-interactive-base);padding:6px 0;font-weight:600;cursor:pointer}
.vld-link-button:hover{text-decoration:underline}
.vld-panel{border:1px solid color-mix(in srgb,var(--border-base) 72%,transparent);border-radius:13px;background:var(--surface-base)}
.vld-panel-pad{padding:22px}
.vld-soft-panel{border-radius:13px;background:var(--surface-inset-base);padding:22px}
.vld-grid{display:grid;gap:18px}
.vld-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.vld-grid-overview{grid-template-columns:minmax(0,1.38fr) minmax(300px,.72fr)}
.vld-stat-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid color-mix(in srgb,var(--border-base) 42%,transparent);border-bottom:1px solid color-mix(in srgb,var(--border-base) 42%,transparent)}
.vld-stat{min-width:0;padding:20px 22px}
.vld-stat+.vld-stat{border-left:1px solid color-mix(in srgb,var(--border-base) 42%,transparent)}
.vld-stat-value{display:block;color:var(--text-strong);font-size:27px;line-height:1.2;font-weight:690;font-variant-numeric:tabular-nums}
.vld-stat-label{display:block;margin-top:5px;color:var(--text-weak);font-size:13px}
.vld-week-hero{display:flex;min-height:192px;align-items:center;justify-content:space-between;gap:32px;padding:26px 30px}
.vld-week-number{margin:2px 0 7px;color:var(--text-strong);font-size:44px;line-height:1;font-weight:730;letter-spacing:-.04em}
.vld-week-meta{color:var(--text-weak)}
.vld-streak{display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--text-warning-base);font-size:13px;font-weight:620}
.vld-heatmap-wrap{min-width:270px}
.vld-heatmap-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}
.vld-heatmap{display:grid;grid-template-columns:repeat(10,18px);gap:6px}
.vld-heat-cell{width:18px;height:18px;border-radius:5px;background:var(--surface-inset-base)}
.vld-heat-cell[data-level="1"]{background:color-mix(in srgb,var(--surface-success-strong) 24%,var(--surface-inset-base))}
.vld-heat-cell[data-level="2"]{background:color-mix(in srgb,var(--surface-success-strong) 48%,var(--surface-inset-base))}
.vld-heat-cell[data-level="3"]{background:color-mix(in srgb,var(--surface-success-strong) 72%,var(--surface-inset-base))}
.vld-heat-cell[data-level="4"]{background:var(--surface-success-strong)}
.vld-range-tabs,.vld-filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vld-chip{min-height:34px;border:1px solid transparent;border-radius:999px;background:var(--surface-inset-base);color:var(--text-weak);padding:6px 11px;cursor:pointer}
.vld-chip:hover{color:var(--text-base)}
.vld-chip[data-active=true]{border-color:var(--border-selected);background:var(--surface-interactive-selected);color:var(--text-interactive-base)}
.vld-chart{width:100%;height:auto;min-height:250px;overflow:visible}
.vld-chart-grid{stroke:color-mix(in srgb,var(--border-base) 48%,transparent);stroke-width:1}
.vld-chart-line{fill:none;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.vld-chart-line[data-series=attempts]{stroke:var(--text-strong)}
.vld-chart-line[data-series=findings]{stroke:var(--surface-warning-strong)}
.vld-chart-line[data-series=natural]{stroke:var(--surface-success-strong)}
.vld-chart-line[data-series=reviews]{stroke:var(--text-interactive-base)}
.vld-chart-label{fill:var(--text-weaker);font-size:11px}
.vld-legend{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 16px}
.vld-legend-item{display:flex;align-items:center;gap:7px;color:var(--text-weak);font-size:12px}
.vld-legend-dot{width:8px;height:8px;border-radius:50%}
.vld-legend-dot[data-series=attempts]{background:var(--text-strong)}
.vld-legend-dot[data-series=findings]{background:var(--surface-warning-strong)}
.vld-legend-dot[data-series=natural]{background:var(--surface-success-strong)}
.vld-legend-dot[data-series=reviews]{background:var(--text-interactive-base)}
.vld-list{margin:0;padding:0;list-style:none}
.vld-list-row{display:grid;grid-template-columns:112px 1fr;gap:18px;padding:18px 2px;border-top:1px solid color-mix(in srgb,var(--border-base) 42%,transparent)}
.vld-list-row:first-child{border-top:0}
.vld-list-date{color:var(--text-weak);font-size:13px}
.vld-list-title{margin:0;color:var(--text-strong);font-weight:620}
.vld-list-meta{margin:4px 0 0;color:var(--text-weak);font-size:13px}
.vld-dot-title{display:flex;align-items:flex-start;gap:10px}
.vld-event-dot{flex:0 0 auto;width:8px;height:8px;margin-top:7px;border-radius:50%;background:var(--surface-success-strong)}
.vld-event-dot[data-kind=review]{background:var(--surface-warning-strong)}
.vld-event-dot[data-kind=pattern]{background:var(--text-interactive-base)}
.vld-review-callout{display:flex;min-height:182px;flex-direction:column;justify-content:space-between;background:var(--surface-success-weak);border:1px solid color-mix(in srgb,var(--surface-success-strong) 22%,transparent)}
.vld-callout-value{margin:5px 0 6px;color:var(--text-strong);font-size:27px;line-height:1.25;font-weight:690;letter-spacing:-.02em}
.vld-callout-copy{margin:0;color:var(--text-weak)}
.vld-primary,.vld-secondary,.vld-danger{display:inline-flex;min-height:40px;align-items:center;justify-content:center;gap:9px;border-radius:8px;padding:8px 14px;font-weight:620;cursor:pointer}
.vld-primary{border:1px solid var(--surface-interactive-solid);background:var(--surface-interactive-solid);color:var(--text-on-interactive-base)}
.vld-primary:hover{background:var(--surface-interactive-solid-hover)}
.vld-secondary{border:1px solid var(--border-base);background:var(--surface-base);color:var(--text-base)}
.vld-secondary:hover{background:var(--surface-base-hover)}
.vld-danger{border:1px solid var(--surface-critical-base);background:var(--surface-critical-weak);color:var(--text-on-critical-base)}
.vld-primary:disabled,.vld-secondary:disabled,.vld-danger:disabled{cursor:not-allowed;opacity:.5}
.vld-full-button{width:100%}
.vld-badge{display:inline-flex;min-height:27px;align-items:center;border-radius:999px;background:var(--surface-inset-base);color:var(--text-weak);padding:3px 9px;font-size:12px;font-weight:620;white-space:nowrap}
.vld-badge[data-status=focus]{background:var(--surface-warning-weak);color:var(--text-warning-base)}
.vld-badge[data-status=improving],.vld-badge[data-status=verified]{background:var(--surface-success-weak);color:var(--text-success-base)}
.vld-badge[data-status=rejected]{background:var(--surface-critical-weak);color:var(--text-on-critical-base)}
.vld-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:15px}
.vld-search{position:relative;min-width:250px}
.vld-input,.vld-select,.vld-textarea{width:100%;border:1px solid var(--border-weaker-base);border-radius:8px;background:var(--input-base);color:var(--text-strong);outline:none}
.vld-input,.vld-select{height:42px;padding:0 12px}
.vld-textarea{min-height:132px;resize:vertical;padding:12px;line-height:1.55}
.vld-input:focus,.vld-select:focus,.vld-textarea:focus{border-color:var(--border-focus);box-shadow:0 0 0 3px color-mix(in srgb,var(--border-focus) 16%,transparent)}
.vld-select{width:auto;min-width:138px;padding-right:34px}
.vld-table-wrap{overflow-x:auto}
.vld-table{width:100%;border-collapse:collapse;table-layout:fixed}
.vld-table th{height:48px;border-bottom:1px solid var(--border-base);color:var(--text-weak);padding:12px 22px;text-align:left;font-size:12px;font-weight:620}
.vld-table td{border-bottom:1px solid color-mix(in srgb,var(--border-base) 55%,transparent);padding:20px 22px;vertical-align:middle}
.vld-table tr:last-child td{border-bottom:0}
.vld-table tr[data-clickable=true]{cursor:pointer}
.vld-table tr[data-clickable=true]:hover td{background:var(--surface-hover-base)}
.vld-pattern-name{display:block;color:var(--text-strong);font-weight:650;overflow-wrap:anywhere}
.vld-pattern-rule{display:block;margin-top:4px;color:var(--text-weak);font-size:13px;overflow-wrap:anywhere}
.vld-number-main{display:block;color:var(--text-strong);font-weight:650;font-variant-numeric:tabular-nums}
.vld-number-sub{display:block;margin-top:3px;color:var(--text-weak);font-size:12px}
.vld-card-list{display:none}
.vld-pagination{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:16px}
.vld-page-count{color:var(--text-weak);font-size:13px}
.vld-back{display:inline-flex;align-items:center;gap:8px;margin-bottom:22px;border:0;background:transparent;color:var(--text-interactive-base);padding:4px 0;font-weight:620;cursor:pointer}
.vld-detail-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;padding-bottom:28px;border-bottom:1px solid color-mix(in srgb,var(--border-base) 50%,transparent)}
.vld-detail-stats{display:flex;align-items:flex-start;gap:32px}
.vld-detail-stat{min-width:88px}
.vld-detail-stat strong{display:block;color:var(--text-strong);font-size:22px}
.vld-detail-stat span{display:block;margin-top:2px;color:var(--text-weak);font-size:12px}
.vld-detail-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.65fr);gap:22px;margin-top:26px}
.vld-detail-section{padding:20px 22px}
.vld-evidence-row{padding:16px 0;border-top:1px solid color-mix(in srgb,var(--border-base) 42%,transparent)}
.vld-evidence-row:first-of-type{border-top:0}
.vld-evidence-top{display:flex;align-items:center;justify-content:space-between;gap:14px}
.vld-evidence-copy{margin:8px 0 0;color:var(--text-weak);overflow-wrap:anywhere}
.vld-action-list{display:grid;gap:8px;margin-top:14px}
.vld-action-list button{justify-content:flex-start}
.vld-empty{display:grid;min-height:240px;place-items:center;padding:36px;text-align:center}
.vld-empty-inner{max-width:440px}
.vld-empty-title{margin:0;color:var(--text-strong);font-size:18px;font-weight:650}
.vld-empty-copy{margin:7px 0 0;color:var(--text-weak)}
.vld-empty-action{margin-top:18px}
.vld-error{border:1px solid var(--surface-critical-base);border-radius:10px;background:var(--surface-critical-weak);color:var(--text-on-critical-base);padding:14px 16px}
.vld-skeleton{display:grid;gap:12px}
.vld-skeleton-line{height:14px;border-radius:6px;background:var(--surface-inset-base)}
.vld-skeleton-line:nth-child(2){width:78%}.vld-skeleton-line:nth-child(3){width:58%}
.vld-profile-menu{position:fixed;z-index:120;width:min(360px,calc(100vw - 16px));max-height:min(520px,calc(100vh - 16px));overflow:auto;border:1px solid var(--border-base);border-radius:11px;background:var(--surface-raised-stronger-non-alpha);box-shadow:0 12px 32px color-mix(in srgb,var(--surface-overlay) 38%,transparent);padding:6px}
.vld-menu-label{padding:8px 9px 5px;color:var(--text-weaker);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.06em}
.vld-menu-item{display:flex;width:100%;min-height:48px;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:7px;background:transparent;color:var(--text-base);padding:9px;text-align:left;cursor:pointer}
.vld-menu-item:hover,.vld-menu-item[data-active=true]{background:var(--surface-hover-base)}
.vld-menu-item-main{display:block;color:var(--text-strong);font-weight:600}
.vld-menu-item-sub{display:block;margin-top:2px;color:var(--text-weak);font-size:12px}
.vld-menu-divider{height:1px;margin:5px;background:var(--border-base)}
.vld-review-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:24px}
.vld-review-stage{min-height:470px;padding:30px}
.vld-progress-track{height:5px;border-radius:999px;background:var(--surface-inset-base);overflow:hidden}
.vld-progress-fill{height:100%;border-radius:inherit;background:var(--surface-success-strong)}
.vld-review-question{margin:34px 0 10px;color:var(--text-strong);font-size:23px;line-height:1.42;font-weight:650;letter-spacing:-.015em}
.vld-review-instruction{margin:0;color:var(--text-weak)}
.vld-review-form{margin-top:28px}
.vld-review-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}
.vld-review-feedback{margin-top:22px;border-left:3px solid var(--surface-warning-strong);background:var(--surface-warning-weak);padding:15px 17px}
.vld-review-feedback[data-kind=success]{border-left-color:var(--surface-success-strong);background:var(--surface-success-weak)}
.vld-hints{display:grid;gap:8px;margin-top:18px}
.vld-hint{border-radius:8px;background:var(--surface-inset-base);padding:12px 14px;color:var(--text-base)}
.vld-queue-list{display:grid;gap:7px;margin-top:14px}
.vld-queue-item{border-radius:8px;background:var(--surface-inset-base);padding:11px 12px}
.vld-queue-item strong{display:block;color:var(--text-strong);font-size:13px}
.vld-queue-item span{display:block;margin-top:2px;color:var(--text-weak);font-size:11px}
.vld-complete-hero{max-width:820px;margin:20px auto 0;text-align:center}
.vld-complete-mark{display:grid;width:52px;height:52px;margin:0 auto 18px;place-items:center;border-radius:50%;background:var(--surface-success-weak);color:var(--text-success-base);font-size:24px}
.vld-complete-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:28px;border-top:1px solid var(--border-base);border-bottom:1px solid var(--border-base)}
.vld-complete-stat{padding:18px 10px}
.vld-complete-stat+.vld-complete-stat{border-left:1px solid var(--border-base)}
.vld-dialog-backdrop{position:fixed;inset:0;z-index:150;display:grid;place-items:center;background:color-mix(in srgb,var(--surface-overlay) 56%,transparent);padding:18px}
.vld-dialog{width:min(520px,100%);max-height:min(720px,calc(100vh - 36px));overflow:auto;border:1px solid var(--border-base);border-radius:13px;background:var(--surface-raised-stronger-non-alpha);padding:22px}
.vld-dialog-title{margin:0;color:var(--text-strong);font-size:18px}
.vld-dialog-copy{margin:6px 0 18px;color:var(--text-weak)}
.vld-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;margin-top:18px}
.vld-settings-wrap{max-width:820px}
.vld-settings-wrap .vl-settings{width:100%;padding:0}
.vld-settings-note{margin:0 0 22px;border-left:3px solid var(--surface-success-strong);background:var(--surface-success-weak);padding:12px 14px;color:var(--text-base)}
.vld-mobile-only{display:none}
.vld-primary:focus-visible,.vld-secondary:focus-visible,.vld-danger:focus-visible,.vld-tab:focus-visible,.vld-link-button:focus-visible,.vld-icon-button:focus-visible,.vld-profile-trigger:focus-visible,.vld-chip:focus-visible,.vld-menu-item:focus-visible,.vld-back:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}
@media(max-width:980px){
 .vld-shell{padding:28px 30px 60px}.vld-grid-overview,.vld-detail-grid,.vld-review-layout{grid-template-columns:1fr}.vld-week-hero{align-items:flex-start}.vld-stat-row{grid-template-columns:repeat(2,1fr)}.vld-stat:nth-child(3){border-left:0;border-top:1px solid color-mix(in srgb,var(--border-base) 42%,transparent)}.vld-stat:nth-child(4){border-top:1px solid color-mix(in srgb,var(--border-base) 42%,transparent)}.vld-review-layout>aside{order:-1}.vld-queue-list{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media(max-width:720px){
 .vld-shell{padding:22px 18px 50px}.vld-topbar{display:block}.vld-top-actions{position:absolute;right:0;top:0}.vld-profile-trigger{min-width:0;width:42px;padding:0;justify-content:center}.vld-profile-trigger .vld-profile-text{display:none}.vld-header-settings{padding-inline:10px}.vld-tabs{padding-right:0;overflow-x:auto}.vld-tab{white-space:nowrap}.vld-main{padding-top:24px}.vld-page-head{display:block}.vld-page-title{font-size:27px}.vld-page-head>.vld-filter-row{margin-top:16px}.vld-week-hero{display:block;padding:22px}.vld-heatmap-wrap{margin-top:24px;min-width:0}.vld-heatmap{grid-template-columns:repeat(10,minmax(12px,18px))}.vld-heat-cell{width:100%;height:auto;aspect-ratio:1}.vld-grid-2{grid-template-columns:1fr}.vld-toolbar{align-items:stretch;flex-direction:column}.vld-search{min-width:0}.vld-filter-row .vld-select{flex:1;min-width:130px}.vld-table-wrap{display:none}.vld-card-list{display:grid;gap:10px}.vld-pattern-card{border:1px solid var(--border-base);border-radius:10px;background:var(--surface-base);padding:17px;cursor:pointer}.vld-pattern-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.vld-pattern-card-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:13px;color:var(--text-weak);font-size:12px}.vld-detail-hero{grid-template-columns:1fr}.vld-detail-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.vld-list-row{grid-template-columns:1fr;gap:5px}.vld-review-stage{min-height:0;padding:22px}.vld-review-question{font-size:20px}.vld-queue-list{grid-template-columns:1fr}.vld-complete-stats{grid-template-columns:repeat(2,1fr)}.vld-complete-stat:nth-child(3){border-left:0;border-top:1px solid var(--border-base)}.vld-complete-stat:nth-child(4){border-top:1px solid var(--border-base)}.vld-dialog-actions{align-items:stretch;flex-direction:column-reverse}.vld-dialog-actions button{width:100%}.vld-mobile-only{display:block}
}
@media(max-width:430px){
 .vld-shell{padding:18px 14px 42px}.vld-brand{font-size:20px}.vld-top-actions{gap:6px}.vld-stat{padding:16px 14px}.vld-stat-value{font-size:23px}.vld-week-number{font-size:38px}.vld-panel-pad,.vld-soft-panel{padding:17px}.vld-review-actions{align-items:stretch;flex-direction:column-reverse}.vld-review-actions button{width:100%}.vld-detail-stats{grid-template-columns:1fr 1fr}.vld-range-tabs{gap:5px}.vld-chip{padding:5px 9px}
}
@media(prefers-reduced-motion:reduce){.vld-app *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`
