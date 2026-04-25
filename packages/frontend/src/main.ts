import "./styles/index.css";
import { AppController } from "./app/AppController";

const appController = new AppController();

window.addEventListener("beforeunload", () => {
  appController.destroy();
});

void appController.start();
