import React from 'react';
import { HStack, Input, Select } from '@chakra-ui/react';

interface DomainFilterProps {
    availableDomains: number;
    unavailableDomains: number;
    filterQuery: string;
    filterType: string;
    setFilterQuery: (query: string) => void;
    setFilterType: (type: string) => void;
}

const DomainFilter: React.FC<DomainFilterProps> = (props) => {
    const {
        availableDomains,
        unavailableDomains,
        filterQuery,
        filterType,
        setFilterQuery,
        setFilterType,
    } = props;

    console.log('Rendering DomainFilter component.');

    if (availableDomains === 0 && unavailableDomains === 0) {
        return null;
    }

    return (
        <HStack spacing={4} direction={{ base: "column", md: "row" }}>
            <Input
                placeholder="Filter domains"
                value={filterQuery}
                onChange={(e) => {
                    console.log(`Changing filter query to: ${e.target.value}`);
                    setFilterQuery(e.target.value);
                }}
                disabled={filterType === "Available" || filterType === "Unavailable"}
            />
            <Select
                value={filterType}
                onChange={(e) => {
                    console.log(`Changing filter type to: ${e.target.value}`);
                    setFilterType(e.target.value);
                }}
            >
                <option value="Name">Name</option>
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
            </Select>
        </HStack>
    );
};

export default DomainFilter;
