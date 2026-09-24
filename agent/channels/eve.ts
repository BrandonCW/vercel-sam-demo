import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc, none } from "eve/channels/auth";

export default eveChannel({
  auth: [localDev(), vercelOidc(), none()],
});
