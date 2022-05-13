import React from 'react'
import { FaPlus, } from 'react-icons/fa';
import { AiFillSetting } from 'react-icons/ai'
import './nav-bar.component.css'

export function NavBar() {
  return (
    <div className='flex flex-col items-center w-fit h-full max-h-full p-2 bg-gray-200 dark:bg-[#202225]'>
      <div className='w-full flex items-start content-start justify-center relative mb-3'>
        <div className='relative aspect-square w-16'>
          <span id='logo-bottom' className='bg-green-400 aspect-square w-16'> </span>
          <span id='logo-top' className='bg-purple-500 aspect-square w-16'> </span>
        </div>
      </div>
      <div className='grow overflow-y-scroll scrollbar-hide'>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div><div className='grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>
        <div className='cursor-pointer grow relative pr-4 pl-4 w-full h-fit flex justify-center items-center content-center pt-2 pb-2 text-center rounded-full overflow-hidden hover:bg-[#2C2F33]'>
          <span className='font-bold text-gray-200'>1.19.0</span>
        </div>

      </div>
      <div className='w-full p-2 flex flex-col items-center content-center justify-start'>
        <span className='cursor-pointer mb-3'>
          <FaPlus className='text-2xl text-blue-500 drop-shadow-lg'/>
        </span>
        <span className='cursor-pointer'>
          <AiFillSetting className='text-2xl text-blue-500 drop-shadow-lg'/>
        </span>

      </div>
    </div>
  )
}
