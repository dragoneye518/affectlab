import { generateHash } from '../../utils/util';
import { getThematicImage } from '../../utils/constants';

Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    template: Object,
    userInput: String
  },
  data: {
    logs: [],
    progress: 0
  },
  lifetimes: {
    attached() {
      this.startGeneration();
    },
    detached() {
      this.cleanup();
    }
  },
  methods: {
    startGeneration() {
      const sysLogs = [
        "INITIALIZING NEURAL LINK...",
        "ENCRYPTING USER INPUT...",
        `CONTEXT: "${this.properties.userInput.substring(0, 15)}..."`,
        "ACCESSING SOUL_DATA_V2...",
        "CONTENT_SAFETY_CHECK_V2... PASS",
        "DECRYPTING EMOTIONAL PATTERNS...",
        "SYNTHESIZING REALITY...",
        "APPLYING CYBER_FILTERS...",
        "FINALIZING..."
      ];

      let logIndex = 0;
      this.logInterval = setInterval(() => {
        if (logIndex < sysLogs.length) {
          const newLogs = [...this.data.logs.slice(-5), `> ${sysLogs[logIndex]}`];
          this.setData({ logs: newLogs });
          logIndex++;
        }
      }, 400);

      this.progressInterval = setInterval(() => {
        if (this.data.progress < 100) {
           this.setData({
             progress: Math.min(100, this.data.progress + Math.random() * 5)
           });
        }
      }, 150);

      this.finishTimeout = setTimeout(() => {
        this.finish();
      }, 4500);
    },
    cleanup() {
      clearInterval(this.logInterval);
      clearInterval(this.progressInterval);
      clearTimeout(this.finishTimeout);
    },
    finish() {
      const { template, userInput } = this.properties;
      const hash = generateHash(userInput + template.id);
      
      let finalMainText = "";
      if (template.id === 'custom-signal') {
          finalMainText = userInput;
      } else {
          finalMainText = template.presetTexts[hash % template.presetTexts.length];
      }

      // Rarity Logic
      const rand = Math.random();
      let rarity = 'N';
      let luckScore = 0;

      if (rand > 0.80) {
          rarity = 'SSR';
          luckScore = 95 + Math.floor(Math.random() * 6); 
      } else if (rand > 0.40) {
          rarity = 'SR';
          luckScore = 80 + Math.floor(Math.random() * 15);
      } else if (rand > 0.20) {
          rarity = 'R';
          luckScore = 60 + Math.floor(Math.random() * 20);
      } else {
          rarity = 'N';
          luckScore = Math.floor(Math.random() * 60);
      }

      const raritySpecificImage = getThematicImage(template.id, rarity);

      const result = {
          id: Date.now().toString(),
          templateId: template.id,
          imageUrl: raritySpecificImage,
          text: finalMainText,
          userInput: userInput,
          timestamp: Date.now(),
          rarity,
          filterSeed: hash % 360,
          luckScore
      };
      
      this.triggerEvent('finish', { result });
    }
  }
})
