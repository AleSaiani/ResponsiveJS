<script setup lang="ts">
/**
 * A resizable panel: drag (or arrow-key) the edge and the content inside
 * reflows for real. Everything r$ does — container-bound fluid values,
 * geometry predicates — reacts to THIS width, not the browser window, so a
 * demo works the same on a phone as on a 4K monitor.
 */
import { ref, onMounted } from 'vue';

const props = withDefaults(defineProps<{ start?: number; min?: number; max?: number; label?: string }>(), {
    start: 420,
    min: 200,
    max: 900,
    label: 'demo',
});

const frame = ref<HTMLElement | null>(null);
const width = ref(props.start);
const dragging = ref(false);

function clamp(value: number): number {
    const available = frame.value?.parentElement?.clientWidth ?? props.max;
    return Math.max(props.min, Math.min(Math.min(props.max, available), Math.round(value)));
}

function onPointerDown(event: PointerEvent): void {
    dragging.value = true;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
}
function onPointerMove(event: PointerEvent): void {
    if (!dragging.value || !frame.value) return;
    width.value = clamp(event.clientX - frame.value.getBoundingClientRect().left);
}
function onPointerUp(): void {
    dragging.value = false;
}
function onKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 50 : 10;
    if (event.key === 'ArrowLeft') width.value = clamp(width.value - step);
    else if (event.key === 'ArrowRight') width.value = clamp(width.value + step);
    else return;
    event.preventDefault();
}

onMounted(() => {
    width.value = clamp(props.start);
});
</script>

<template>
    <figure class="demo">
        <div ref="frame" class="frame" :style="{ width: `${width}px` }">
            <div class="stage"><slot /></div>
            <div
                class="grip"
                role="slider"
                tabindex="0"
                :aria-label="`Resize the ${label} demo`"
                :aria-valuemin="min"
                :aria-valuemax="max"
                :aria-valuenow="width"
                :aria-valuetext="`${width} pixels`"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @keydown="onKeydown"
            />
        </div>
        <figcaption>
            <strong>{{ width }}px</strong> — drag the handle (or focus it and use ←/→)
        </figcaption>
    </figure>
</template>

<style scoped>
.demo { margin: 1.5rem 0; }
.frame {
    position: relative;
    container-type: inline-size;
    border: 1px solid var(--vp-c-divider);
    border-radius: 10px;
    background: var(--vp-c-bg-alt);
    max-width: 100%;
    overflow: hidden;
}
.stage { padding: 1rem 1.25rem; }
.grip {
    position: absolute;
    top: 0;
    right: 0;
    width: 24px;
    height: 100%;
    cursor: ew-resize;
    touch-action: none;
    background: linear-gradient(to right, transparent, var(--vp-c-divider));
}
.grip::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 8px;
    width: 4px;
    height: 32px;
    margin-top: -16px;
    border-radius: 2px;
    background: var(--vp-c-text-3);
}
.grip:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: -2px; }
figcaption { margin-top: .5rem; font-size: .85rem; color: var(--vp-c-text-2); }
</style>
