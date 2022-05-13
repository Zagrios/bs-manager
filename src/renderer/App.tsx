import { NavBar } from "./components/nav-bar/nav-bar.component";
import TitleBar from "./components/title-bar/title-bar.component";

export default function App() {

  return (
    <div className="w-screen h-screen overflow-hidden flex dark:bg-[#202225]">
      <NavBar/>
      <div className="flex flex-col grow">
        <TitleBar/>
        <div className="bg-[#2C2F33] rounded-tl-lg grow">
          a
        </div>
      </div>
    </div>
  );
}
