import {ChakraProvider, Box, Image, Divider} from "@chakra-ui/react";
import { AppProps } from "next/app";


// Tailwind and other styles
import "@/styles/globals.css";
import React from "react";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider>
        <Box display="flex" justifyContent="center" alignItems="center" w="100%" h="50%">
            <Image
                align="center"
                boxSize='100px'
                borderRadius='full'
                src="/logo.svg"
                alt='Domain Buyer'
            />
        </Box>
        <Divider mb={-8} style={{ backgroundColor: 'black', height: '2px'}} />
        <Component {...pageProps} />
    </ChakraProvider>
  );
}

export default MyApp;
