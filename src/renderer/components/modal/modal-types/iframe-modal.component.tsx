import { ModalComponent } from "renderer/services/modale.service"

export const IframeModal: ModalComponent<void, string> = ({resolver, data}) => {
  return (
    <div className="w-[calc(100vw-250px)] h-[calc(100vh-250px)]">
        <iframe className="w-full h-full" src={data}></iframe>
    </div>
  )
}
