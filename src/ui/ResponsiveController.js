export function createResponsiveController({window,$}) {
      function setupResponsivePanels() {
        if (!('matchMedia' in window)) return;
        const compact = window.matchMedia('(max-width: 900px)');
        const updatePanels = () => {
          ['sound-settings','mix-settings','history-card'].forEach(id => {
            $(id).open = !compact.matches;
          });
        };
        updatePanels();
        if (compact.addEventListener) compact.addEventListener('change',updatePanels);
        else if (compact.addListener) compact.addListener(updatePanels);
      }
return setupResponsivePanels;
}
