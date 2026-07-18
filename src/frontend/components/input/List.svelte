<!-- used to display option inputs -->

<script lang="ts">
    export let bottom = 0
    export let top = 0

    $: safeBottom = Number.isFinite(bottom) ? Math.max(0, bottom) : 0
    $: safeTop = Number.isFinite(top) ? Math.max(0, top) : 0
</script>

<div class="list" style="margin-bottom: {safeBottom}px;margin-top: {safeTop}px;{$$props.style || ''}">
    <slot />
</div>

<style>
    .list {
        display: flex;
        flex-direction: column;
        /* gap: 5px; */
    }
</style>
