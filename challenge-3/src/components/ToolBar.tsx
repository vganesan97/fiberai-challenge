import React from 'react';
import { Button, HStack, VStack } from '@chakra-ui/react';

interface ToolBarProps {
    isSmallScreen: boolean;
    clearCart: () => void;
    removeUnavailableDomains: () => void;
    copyDomainsToClipboard: () => void;
    keepBestDomains: () => void;
    undoLastAction: () => void;
    redoLastAction: () => void;
}


const ToolBar: React.FC<ToolBarProps> = (props: ToolBarProps) => {
    const {
        isSmallScreen,
        clearCart,
        removeUnavailableDomains,
        copyDomainsToClipboard,
        keepBestDomains,
        undoLastAction,
        redoLastAction,
    } = props;

    return (
        // JSX for displaying toolbar buttons
        <div>
            {
                isSmallScreen ?
                    (
                        <VStack spacing={4}>
                            <Button onClick={clearCart}>Clear Cart</Button>
                            <Button onClick={removeUnavailableDomains}>Remove Unavailable Domains</Button>
                            <Button onClick={copyDomainsToClipboard}>Copy Domains to Clipboard</Button>
                            <Button onClick={keepBestDomains}>Keep Best Domains</Button>
                            <HStack spacing={4}>
                                <Button onClick={undoLastAction}>Undo</Button>
                                <Button onClick={redoLastAction}>Redo</Button>
                            </HStack>
                        </VStack>
                    ) :
                    (
                        <HStack spacing={4}>
                            <Button onClick={clearCart}>Clear Cart</Button>
                            <Button onClick={removeUnavailableDomains}>Remove Unavailable Domains</Button>
                            <Button onClick={copyDomainsToClipboard}>Copy Domains to Clipboard</Button>
                            <Button onClick={keepBestDomains}>Keep Best Domains</Button>
                            <Button onClick={undoLastAction}>Undo</Button>
                            <Button onClick={redoLastAction}>Redo</Button>
                        </HStack>
                    )
            }
        </div>
    );
};

export default ToolBar;
