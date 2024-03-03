import { EdDSATicketPCDPackage, ITicketData } from "@pcd/eddsa-ticket-pcd";
import {
  constructZupassPcdGetRequestUrl,
  openZupassPopup,
  useZupassPopupMessages
} from "@pcd/passport-interface";
import { ArgumentTypeName } from "@pcd/pcd-types";
import { SemaphoreIdentityPCDPackage } from "@pcd/semaphore-identity-pcd";
import {
  EdDSATicketFieldsToReveal,
  ZKEdDSAEventTicketPCDArgs,
  ZKEdDSAEventTicketPCDPackage
} from "@pcd/zk-eddsa-event-ticket-pcd";
import { useEffect, useState } from "react";
import "./App.css";
import { badgePatterns, ticketPatterns } from "./EdgeCityTickets";

/**
 * Opens a Zupass popup to make a proof of a ZK EdDSA event ticket PCD.
 */
function openZKEdDSAEventTicketPopup(
  fieldsToReveal: EdDSATicketFieldsToReveal,
  watermark: bigint,
  validEventIds: string[],
  validProductIds: string[]
) {
  // These arguments determine the options that will be passed in to the ZK
  // proving screen. Where `userProvided` is true, the user must input or
  // select an option.
  // This particular proof will be a proof about an EdDSA ticket that the user
  // owns, and so the options relate to the selection of the ticket and the
  // claim that the user will make about it.
  const args: ZKEdDSAEventTicketPCDArgs = {
    // This allows the user to choose a ticket to make a proof about.
    ticket: {
      argumentType: ArgumentTypeName.PCD,
      pcdType: EdDSATicketPCDPackage.name,
      value: undefined,
      userProvided: true,
      validatorParams: {
        // It is possible to filter the tickets the user can choose from by
        // event ID and product ID. Empty arrays mean that no filtering will
        // occur.
        eventIds: validEventIds,
        productIds: validProductIds,
        notFoundMessage: "No eligible PCDs found"
      }
    },
    // This is the user's Semaphore identity, which is required in order to
    // prove that the user controls the identity that the ticket was created
    // for.
    identity: {
      argumentType: ArgumentTypeName.PCD,
      pcdType: SemaphoreIdentityPCDPackage.name,
      value: undefined,
      userProvided: true
    },
    // If we want the proof to show that the ticket belongs to a certain event
    // or set of events, the event IDs can be passed in here.
    validEventIds: {
      argumentType: ArgumentTypeName.StringArray,
      // For this example, we are not going to restrict event IDs in the proof,
      // since it has a limit of 20 IDs, and we have more than 20.
      value: undefined,
      userProvided: false
    },
    // The fields to reveal in the claim.
    fieldsToReveal: {
      argumentType: ArgumentTypeName.ToggleList,
      value: fieldsToReveal,
      userProvided: false
    },
    // The watermark can be used to ensure that the proof is used only once.
    // This can be done by, for example, generating a random number, passing
    // it in as the watermark, and then checking that the proof contains a
    // matching watermark.
    watermark: {
      argumentType: ArgumentTypeName.BigInt,
      value: watermark.toString(),
      userProvided: false
    },
    // The external nullifier is an input into the nullifier hash, which is a
    // function of the user's identity and the external nullifier. The
    // nullifier hash can be used to determine that two proofs with identical
    // nullifier hashes where produced by the same user, without revealing the
    // user's identity (provided that the external nullifier is the same in
    // both cases).
    externalNullifier: {
      argumentType: ArgumentTypeName.BigInt,
      value: "12345",
      userProvided: false
    }
  };

  const popupUrl = window.location.origin + "/popup";
  const ZUPASS_PRODUCTION_URL = "https://zupass.org";

  // Create the Zupass URL which will be loaded in the popup window.
  const proofUrl = constructZupassPcdGetRequestUrl(
    import.meta.env.ZUPASS_SERVER_URL ?? ZUPASS_PRODUCTION_URL,
    popupUrl,
    ZKEdDSAEventTicketPCDPackage.name,
    args,
    {
      genericProveScreen: true,
      title: "ZKEdDSA Ticket Proof",
      description: "ZKEdDSA Ticket PCD Request"
    }
  );

  // Open the popup window. This points /popup on the local site, with the
  // Zupass URL as a query parameter. In `popup.tsx` we do a redirect to the
  // Zupass URL.
  openZupassPopup(popupUrl, proofUrl);
}

function getLabelFromTicket(ticketData: Partial<ITicketData>): string {
  const foundTicket = Object.entries(ticketPatterns).find(([_key, value]) => {
    return value.eventId === ticketData.eventId && value.productId && ticketData.productId;
  });

  if (foundTicket) {
    return `You presented a ticket for: ${foundTicket[0]}`;
  }

  const foundBadge = Object.entries(badgePatterns).find(([_key, value]) => {
    return value.eventId === ticketData.eventId && value.productId && ticketData.productId;
  });

  if (foundBadge) {
    return `You presented a badge: ${foundBadge[0]}`;
  }

  return `Could not recognize either a ticket or a badge`;
}

function App() {
  const openPopup = () => {
    openZKEdDSAEventTicketPopup(
      { revealAttendeeEmail: true, revealEventId: true, revealProductId: true },
      BigInt(0),
      [...Object.values(ticketPatterns).map(ticket => ticket.eventId),
       ...Object.values(badgePatterns).map(badge => badge.eventId)],
      []
    );
  };

  const [pcdStr] = useZupassPopupMessages();
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      if (pcdStr) {
        console.log(pcdStr);
        const pcd = await ZKEdDSAEventTicketPCDPackage.deserialize(
          JSON.parse(pcdStr).pcd
        );

        if (pcd && (await ZKEdDSAEventTicketPCDPackage.verify(pcd))) {
          setEmail(pcd.claim.partialTicket.attendeeEmail ?? "");
          setLabel(getLabelFromTicket(pcd.claim.partialTicket));
        } else {
          setError("Could not verify PCD");
        }
      }
    })();
  }, [pcdStr]);

  return (
    <main className="root">
      <div className="">
        <button onClick={openPopup}>Click me</button>
        {email && <div>Your email address is {email}</div>}
        {label && <div>{label}</div>}
        {error && <div>{error}</div>}
      </div>
    </main>
  );
}

export default App;
