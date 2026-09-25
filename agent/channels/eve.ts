import { eveChannel } from "eve/channels/eve";
import { EVE_CHANNEL_AUTH } from "@/lib/eve-auth";

export default eveChannel({
  auth: EVE_CHANNEL_AUTH,
});
